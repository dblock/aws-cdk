"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const redshift_data_1 = require("./redshift-data");
const types_1 = require("./types");
const util_1 = require("./util");
async function handler(props, event) {
    const tableNamePrefix = props.tableName.prefix;
    const tableNameSuffix = props.tableName.generateSuffix === 'true' ? `${event.RequestId.substring(0, 8)}` : '';
    const tableColumns = props.tableColumns;
    const tableAndClusterProps = props;
    if (event.RequestType === 'Create') {
        const tableName = await createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
        return { PhysicalResourceId: tableName };
    }
    else if (event.RequestType === 'Delete') {
        await dropTable(event.PhysicalResourceId, tableAndClusterProps);
        return;
    }
    else if (event.RequestType === 'Update') {
        const tableName = await updateTable(event.PhysicalResourceId, tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps, event.OldResourceProperties);
        return { PhysicalResourceId: tableName };
    }
    else {
        /* eslint-disable-next-line dot-notation */
        throw new Error(`Unrecognized event type: ${event['RequestType']}`);
    }
}
exports.handler = handler;
async function createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps) {
    const tableName = tableNamePrefix + tableNameSuffix;
    const tableColumnsString = tableColumns.map(column => `${column.name} ${column.dataType}`).join();
    let statement = `CREATE TABLE ${tableName} (${tableColumnsString})`;
    if (tableAndClusterProps.distStyle) {
        statement += ` DISTSTYLE ${tableAndClusterProps.distStyle}`;
    }
    const distKeyColumn = util_1.getDistKeyColumn(tableColumns);
    if (distKeyColumn) {
        statement += ` DISTKEY(${distKeyColumn.name})`;
    }
    const sortKeyColumns = util_1.getSortKeyColumns(tableColumns);
    if (sortKeyColumns.length > 0) {
        const sortKeyColumnsString = getSortKeyColumnsString(sortKeyColumns);
        statement += ` ${tableAndClusterProps.sortStyle} SORTKEY(${sortKeyColumnsString})`;
    }
    await redshift_data_1.executeStatement(statement, tableAndClusterProps);
    return tableName;
}
async function dropTable(tableName, clusterProps) {
    await redshift_data_1.executeStatement(`DROP TABLE ${tableName}`, clusterProps);
}
async function updateTable(tableName, tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps, oldResourceProperties) {
    const alterationStatements = [];
    const oldClusterProps = oldResourceProperties;
    if (tableAndClusterProps.clusterName !== oldClusterProps.clusterName || tableAndClusterProps.databaseName !== oldClusterProps.databaseName) {
        return createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
    }
    const oldTableNamePrefix = oldResourceProperties.tableName.prefix;
    if (tableNamePrefix !== oldTableNamePrefix) {
        return createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
    }
    const oldTableColumns = oldResourceProperties.tableColumns;
    const columnDeletions = oldTableColumns.filter(oldColumn => (tableColumns.every(column => oldColumn.name !== column.name)));
    if (columnDeletions.length > 0) {
        alterationStatements.push(...columnDeletions.map(column => `ALTER TABLE ${tableName} DROP COLUMN ${column.name}`));
    }
    const columnAdditions = tableColumns.filter(column => {
        return !oldTableColumns.some(oldColumn => column.name === oldColumn.name && column.dataType === oldColumn.dataType);
    }).map(column => `ADD ${column.name} ${column.dataType}`);
    if (columnAdditions.length > 0) {
        alterationStatements.push(...columnAdditions.map(addition => `ALTER TABLE ${tableName} ${addition}`));
    }
    const oldDistStyle = oldResourceProperties.distStyle;
    if ((!oldDistStyle && tableAndClusterProps.distStyle) ||
        (oldDistStyle && !tableAndClusterProps.distStyle)) {
        return createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
    }
    else if (oldDistStyle !== tableAndClusterProps.distStyle) {
        alterationStatements.push(`ALTER TABLE ${tableName} ALTER DISTSTYLE ${tableAndClusterProps.distStyle}`);
    }
    const oldDistKey = util_1.getDistKeyColumn(oldTableColumns)?.name;
    const newDistKey = util_1.getDistKeyColumn(tableColumns)?.name;
    if ((!oldDistKey && newDistKey) || (oldDistKey && !newDistKey)) {
        return createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
    }
    else if (oldDistKey !== newDistKey) {
        alterationStatements.push(`ALTER TABLE ${tableName} ALTER DISTKEY ${newDistKey}`);
    }
    const oldSortKeyColumns = util_1.getSortKeyColumns(oldTableColumns);
    const newSortKeyColumns = util_1.getSortKeyColumns(tableColumns);
    const oldSortStyle = oldResourceProperties.sortStyle;
    const newSortStyle = tableAndClusterProps.sortStyle;
    if ((oldSortStyle === newSortStyle && !util_1.areColumnsEqual(oldSortKeyColumns, newSortKeyColumns))
        || (oldSortStyle !== newSortStyle)) {
        switch (newSortStyle) {
            case types_1.TableSortStyle.INTERLEAVED:
                // INTERLEAVED sort key addition requires replacement.
                // https://docs.aws.amazon.com/redshift/latest/dg/r_ALTER_TABLE.html
                return createTable(tableNamePrefix, tableNameSuffix, tableColumns, tableAndClusterProps);
            case types_1.TableSortStyle.COMPOUND: {
                const sortKeyColumnsString = getSortKeyColumnsString(newSortKeyColumns);
                alterationStatements.push(`ALTER TABLE ${tableName} ALTER ${newSortStyle} SORTKEY(${sortKeyColumnsString})`);
                break;
            }
            case types_1.TableSortStyle.AUTO: {
                alterationStatements.push(`ALTER TABLE ${tableName} ALTER SORTKEY ${newSortStyle}`);
                break;
            }
        }
    }
    await Promise.all(alterationStatements.map(statement => redshift_data_1.executeStatement(statement, tableAndClusterProps)));
    return tableName;
}
function getSortKeyColumnsString(sortKeyColumns) {
    return sortKeyColumns.map(column => column.name).join();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFibGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0YWJsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQSxtREFBbUQ7QUFDbkQsbUNBQTZFO0FBQzdFLGlDQUE4RTtBQUV2RSxLQUFLLFVBQVUsT0FBTyxDQUFDLEtBQTJCLEVBQUUsS0FBa0Q7SUFDM0csTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUM7SUFDL0MsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDOUcsTUFBTSxZQUFZLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQztJQUN4QyxNQUFNLG9CQUFvQixHQUFHLEtBQUssQ0FBQztJQUVuQyxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssUUFBUSxFQUFFO1FBQ2xDLE1BQU0sU0FBUyxHQUFHLE1BQU0sV0FBVyxDQUFDLGVBQWUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFDMUcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLFNBQVMsRUFBRSxDQUFDO0tBQzFDO1NBQU0sSUFBSSxLQUFLLENBQUMsV0FBVyxLQUFLLFFBQVEsRUFBRTtRQUN6QyxNQUFNLFNBQVMsQ0FBQyxLQUFLLENBQUMsa0JBQWtCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztRQUNoRSxPQUFPO0tBQ1I7U0FBTSxJQUFJLEtBQUssQ0FBQyxXQUFXLEtBQUssUUFBUSxFQUFFO1FBQ3pDLE1BQU0sU0FBUyxHQUFHLE1BQU0sV0FBVyxDQUNqQyxLQUFLLENBQUMsa0JBQWtCLEVBQ3hCLGVBQWUsRUFDZixlQUFlLEVBQ2YsWUFBWSxFQUNaLG9CQUFvQixFQUNwQixLQUFLLENBQUMs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LENBQUMsQ0FBQztnQkFDNUIsTUFBTSxvQkFBb0IsR0FBRyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2dCQUN4RSxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxTQUFTLFVBQVUsWUFBWSxZQUFZLG9CQUFvQixHQUFHLENBQUMsQ0FBQztnQkFDN0csTUFBTTthQUNQO1lBRUQsS0FBSyxzQkFBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN4QixvQkFBb0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxTQUFTLGtCQUFrQixZQUFZLEVBQUUsQ0FBQyxDQUFDO2dCQUNwRixNQUFNO2FBQ1A7U0FDRjtLQUNGO0lBRUQsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLGdDQUFnQixDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUU1RyxPQUFPLFNBQVMsQ0FBQztBQUNuQixDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxjQUF3QjtJQUN2RCxPQUFPLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDMUQsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBpbXBvcnQvbm8tdW5yZXNvbHZlZCAqL1xuaW1wb3J0ICogYXMgQVdTTGFtYmRhIGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29sdW1uIH0gZnJvbSAnLi4vLi4vdGFibGUnO1xuaW1wb3J0IHsgZXhlY3V0ZVN0YXRlbWVudCB9IGZyb20gJy4vcmVkc2hpZnQtZGF0YSc7XG5pbXBvcnQgeyBDbHVzdGVyUHJvcHMsIFRhYmxlQW5kQ2x1c3RlclByb3BzLCBUYWJsZVNvcnRTdHlsZSB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgYXJlQ29sdW1uc0VxdWFsLCBnZXREaXN0S2V5Q29sdW1uLCBnZXRTb3J0S2V5Q29sdW1ucyB9IGZyb20gJy4vdXRpbCc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVyKHByb3BzOiBUYWJsZUFuZENsdXN0ZXJQcm9wcywgZXZlbnQ6IEFXU0xhbWJkYS5DbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlRXZlbnQpIHtcbiAgY29uc3QgdGFibGVOYW1lUHJlZml4ID0gcHJvcHMudGFibGVOYW1lLnByZWZpeDtcbiAgY29uc3QgdGFibGVOYW1lU3VmZml4ID0gcHJvcHMudGFibGVOYW1lLmdlbmVyYXRlU3VmZml4ID09PSAndHJ1ZScgPyBgJHtldmVudC5SZXF1ZXN0SWQuc3Vic3RyaW5nKDAsIDgpfWAgOiAnJztcbiAgY29uc3QgdGFibGVDb2x1bW5zID0gcHJvcHMudGFibGVDb2x1bW5zO1xuICBjb25zdCB0YWJsZUFuZENsdXN0ZXJQcm9wcyA9IHByb3BzO1xuXG4gIGlmIChldmVudC5SZXF1ZXN0VHlwZSA9PT0gJ0NyZWF0ZScpIHtcbiAgICBjb25zdCB0YWJsZU5hbWUgPSBhd2FpdCBjcmVhdGVUYWJsZSh0YWJsZU5hbWVQcmVmaXgsIHRhYmxlTmFtZVN1ZmZpeCwgdGFibGVDb2x1bW5zLCB0YWJsZUFuZENsdXN0ZXJQcm9wcyk7XG4gICAgcmV0dXJuIHsgUGh5c2ljYWxSZXNvdXJjZUlkOiB0YWJsZU5hbWUgfTtcbiAgfSBlbHNlIGlmIChldmVudC5SZXF1ZXN0VHlwZSA9PT0gJ0RlbGV0ZScpIHtcbiAgICBhd2FpdCBkcm9wVGFibGUoZXZlbnQuUGh5c2ljYWxSZXNvdXJjZUlkLCB0YWJsZUFuZENsdXN0ZXJQcm9wcyk7XG4gICAgcmV0dXJuO1xuICB9IGVsc2UgaWYgKGV2ZW50LlJlcXVlc3RUeXBlID09PSAnVXBkYXRlJykge1xuICAgIGNvbnN0IHRhYmxlTmFtZSA9IGF3YWl0IHVwZGF0ZVRhYmxlKFxuICAgICAgZXZlbnQuUGh5c2ljYWxSZXNvdXJjZUlkLFxuICAgICAgdGFibGVOYW1lUHJlZml4LFxuICAgICAgdGFibGVOYW1lU3VmZml4LFxuICAgICAgdGFibGVDb2x1bW5zLFxuICAgICAgdGFibGVBbmRDbHVzdGVyUHJvcHMsXG4gICAgICBldmVudC5PbGRSZXNvdXJjZVByb3BlcnRpZXMgYXMgVGFibGVBbmRDbHVzdGVyUHJvcHMsXG4gICAgKTtcbiAgICByZXR1cm4geyBQaHlzaWNhbFJlc291cmNlSWQ6IHRhYmxlTmFtZSB9O1xuICB9IGVsc2Uge1xuICAgIC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBkb3Qtbm90YXRpb24gKi9cbiAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBldmVudCB0eXBlOiAke2V2ZW50WydSZXF1ZXN0VHlwZSddfWApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVRhYmxlKFxuICB0YWJsZU5hbWVQcmVmaXg6IHN0cmluZyxcbiAgdGFibGVOYW1lU3VmZml4OiBzdHJpbmcsXG4gIHRhYmxlQ29sdW1uczogQ29sdW1uW10sXG4gIHRhYmxlQW5kQ2x1c3RlclByb3BzOiBUYWJsZUFuZENsdXN0ZXJQcm9wcyxcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHRhYmxlTmFtZSA9IHRhYmxlTmFtZVByZWZpeCArIHRhYmxlTmFtZVN1ZmZpeDtcbiAgY29uc3QgdGFibGVDb2x1bW5zU3RyaW5nID0gdGFibGVDb2x1bW5zLm1hcChjb2x1bW4gPT4gYCR7Y29sdW1uLm5hbWV9ICR7Y29sdW1uLmRhdGFUeXBlfWApLmpvaW4oKTtcblxuICBsZXQgc3RhdGVtZW50ID0gYENSRUFURSBUQUJMRSAke3RhYmxlTmFtZX0gKCR7dGFibGVDb2x1bW5zU3RyaW5nfSlgO1xuXG4gIGlmICh0YWJsZUFuZENsdXN0ZXJQcm9wcy5kaXN0U3R5bGUpIHtcbiAgICBzdGF0ZW1lbnQgKz0gYCBESVNUU1RZTEUgJHt0YWJsZUFuZENsdXN0ZXJQcm9wcy5kaXN0U3R5bGV9YDtcbiAgfVxuXG4gIGNvbnN0IGRpc3RLZXlDb2x1bW4gPSBnZXREaXN0S2V5Q29sdW1uKHRhYmxlQ29sdW1ucyk7XG4gIGlmIChkaXN0S2V5Q29sdW1uKSB7XG4gICAgc3RhdGVtZW50ICs9IGAgRElTVEtFWSgke2Rpc3RLZXlDb2x1bW4ubmFtZX0pYDtcbiAgfVxuXG4gIGNvbnN0IHNvcnRLZXlDb2x1bW5zID0gZ2V0U29ydEtleUNvbHVtbnModGFibGVDb2x1bW5zKTtcbiAgaWYgKHNvcnRLZXlDb2x1bW5zLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBzb3J0S2V5Q29sdW1uc1N0cmluZyA9IGdldFNvcnRLZXlDb2x1bW5zU3RyaW5nKHNvcnRLZXlDb2x1bW5zKTtcbiAgICBzdGF0ZW1lbnQgKz0gYCAke3RhYmxlQW5kQ2x1c3RlclByb3BzLnNvcnRTdHlsZX0gU09SVEtFWSgke3NvcnRLZXlDb2x1bW5zU3RyaW5nfSlgO1xuICB9XG5cbiAgYXdhaXQgZXhlY3V0ZVN0YXRlbWVudChzdGF0ZW1lbnQsIHRhYmxlQW5kQ2x1c3RlclByb3BzKTtcbiAgcmV0dXJuIHRhYmxlTmFtZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZHJvcFRhYmxlKHRhYmxlTmFtZTogc3RyaW5nLCBjbHVzdGVyUHJvcHM6IENsdXN0ZXJQcm9wcykge1xuICBhd2FpdCBleGVjdXRlU3RhdGVtZW50KGBEUk9QIFRBQkxFICR7dGFibGVOYW1lfWAsIGNsdXN0ZXJQcm9wcyk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVRhYmxlKFxuICB0YWJsZU5hbWU6IHN0cmluZyxcbiAgdGFibGVOYW1lUHJlZml4OiBzdHJpbmcsXG4gIHRhYmxlTmFtZVN1ZmZpeDogc3RyaW5nLFxuICB0YWJsZUNvbHVtbnM6IENvbHVtbltdLFxuICB0YWJsZUFuZENsdXN0ZXJQcm9wczogVGFibGVBbmRDbHVzdGVyUHJvcHMsXG4gIG9sZFJlc291cmNlUHJvcGVydGllczogVGFibGVBbmRDbHVzdGVyUHJvcHMsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBjb25zdCBhbHRlcmF0aW9uU3RhdGVtZW50czogc3RyaW5nW10gPSBbXTtcblxuICBjb25zdCBvbGRDbHVzdGVyUHJvcHMgPSBvbGRSZXNvdXJjZVByb3BlcnRpZXM7XG4gIGlmICh0YWJsZUFuZENsdXN0ZXJQcm9wcy5jbHVzdGVyTmFtZSAhPT0gb2xkQ2x1c3RlclByb3BzLmNsdXN0ZXJOYW1lIHx8IHRhYmxlQW5kQ2x1c3RlclByb3BzLmRhdGFiYXNlTmFtZSAhPT0gb2xkQ2x1c3RlclByb3BzLmRhdGFiYXNlTmFtZSkge1xuICAgIHJldHVybiBjcmVhdGVUYWJsZSh0YWJsZU5hbWVQcmVmaXgsIHRhYmxlTmFtZVN1ZmZpeCwgdGFibGVDb2x1bW5zLCB0YWJsZUFuZENsdXN0ZXJQcm9wcyk7XG4gIH1cblxuICBjb25zdCBvbGRUYWJsZU5hbWVQcmVmaXggPSBvbGRSZXNvdXJjZVByb3BlcnRpZXMudGFibGVOYW1lLnByZWZpeDtcbiAgaWYgKHRhYmxlTmFtZVByZWZpeCAhPT0gb2xkVGFibGVOYW1lUHJlZml4KSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRhYmxlKHRhYmxlTmFtZVByZWZpeCwgdGFibGVOYW1lU3VmZml4LCB0YWJsZUNvbHVtbnMsIHRhYmxlQW5kQ2x1c3RlclByb3BzKTtcbiAgfVxuXG4gIGNvbnN0IG9sZFRhYmxlQ29sdW1ucyA9IG9sZFJlc291cmNlUHJvcGVydGllcy50YWJsZUNvbHVtbnM7XG4gIGNvbnN0IGNvbHVtbkRlbGV0aW9ucyA9IG9sZFRhYmxlQ29sdW1ucy5maWx0ZXIob2xkQ29sdW1uID0+IChcbiAgICB0YWJsZUNvbHVtbnMuZXZlcnkoY29sdW1uID0+IG9sZENvbHVtbi5uYW1lICE9PSBjb2x1bW4ubmFtZSlcbiAgKSk7XG4gIGlmIChjb2x1bW5EZWxldGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGFsdGVyYXRpb25TdGF0ZW1lbnRzLnB1c2goLi4uY29sdW1uRGVsZXRpb25zLm1hcChjb2x1bW4gPT4gYEFMVEVSIFRBQkxFICR7dGFibGVOYW1lfSBEUk9QIENPTFVNTiAke2NvbHVtbi5uYW1lfWApKTtcbiAgfVxuXG4gIGNvbnN0IGNvbHVtbkFkZGl0aW9ucyA9IHRhYmxlQ29sdW1ucy5maWx0ZXIoY29sdW1uID0+IHtcbiAgICByZXR1cm4gIW9sZFRhYmxlQ29sdW1ucy5zb21lKG9sZENvbHVtbiA9PiBjb2x1bW4ubmFtZSA9PT0gb2xkQ29sdW1uLm5hbWUgJiYgY29sdW1uLmRhdGFUeXBlID09PSBvbGRDb2x1bW4uZGF0YVR5cGUpO1xuICB9KS5tYXAoY29sdW1uID0+IGBBREQgJHtjb2x1bW4ubmFtZX0gJHtjb2x1bW4uZGF0YVR5cGV9YCk7XG4gIGlmIChjb2x1bW5BZGRpdGlvbnMubGVuZ3RoID4gMCkge1xuICAgIGFsdGVyYXRpb25TdGF0ZW1lbnRzLnB1c2goLi4uY29sdW1uQWRkaXRpb25zLm1hcChhZGRpdGlvbiA9PiBgQUxURVIgVEFCTEUgJHt0YWJsZU5hbWV9ICR7YWRkaXRpb259YCkpO1xuICB9XG5cbiAgY29uc3Qgb2xkRGlzdFN0eWxlID0gb2xkUmVzb3VyY2VQcm9wZXJ0aWVzLmRpc3RTdHlsZTtcbiAgaWYgKCghb2xkRGlzdFN0eWxlICYmIHRhYmxlQW5kQ2x1c3RlclByb3BzLmRpc3RTdHlsZSkgfHxcbiAgICAob2xkRGlzdFN0eWxlICYmICF0YWJsZUFuZENsdXN0ZXJQcm9wcy5kaXN0U3R5bGUpKSB7XG4gICAgcmV0dXJuIGNyZWF0ZVRhYmxlKHRhYmxlTmFtZVByZWZpeCwgdGFibGVOYW1lU3VmZml4LCB0YWJsZUNvbHVtbnMsIHRhYmxlQW5kQ2x1c3RlclByb3BzKTtcbiAgfSBlbHNlIGlmIChvbGREaXN0U3R5bGUgIT09IHRhYmxlQW5kQ2x1c3RlclByb3BzLmRpc3RTdHlsZSkge1xuICAgIGFsdGVyYXRpb25TdGF0ZW1lbnRzLnB1c2goYEFMVEVSIFRBQkxFICR7dGFibGVOYW1lfSBBTFRFUiBESVNUU1RZTEUgJHt0YWJsZUFuZENsdXN0ZXJQcm9wcy5kaXN0U3R5bGV9YCk7XG4gIH1cblxuICBjb25zdCBvbGREaXN0S2V5ID0gZ2V0RGlzdEtleUNvbHVtbihvbGRUYWJsZUNvbHVtbnMpPy5uYW1lO1xuICBjb25zdCBuZXdEaXN0S2V5ID0gZ2V0RGlzdEtleUNvbHVtbih0YWJsZUNvbHVtbnMpPy5uYW1lO1xuICBpZiAoKCFvbGREaXN0S2V5ICYmIG5ld0Rpc3RLZXkgKSB8fCAob2xkRGlzdEtleSAmJiAhbmV3RGlzdEtleSkpIHtcbiAgICByZXR1cm4gY3JlYXRlVGFibGUodGFibGVOYW1lUHJlZml4LCB0YWJsZU5hbWVTdWZmaXgsIHRhYmxlQ29sdW1ucywgdGFibGVBbmRDbHVzdGVyUHJvcHMpO1xuICB9IGVsc2UgaWYgKG9sZERpc3RLZXkgIT09IG5ld0Rpc3RLZXkpIHtcbiAgICBhbHRlcmF0aW9uU3RhdGVtZW50cy5wdXNoKGBBTFRFUiBUQUJMRSAke3RhYmxlTmFtZX0gQUxURVIgRElTVEtFWSAke25ld0Rpc3RLZXl9YCk7XG4gIH1cblxuICBjb25zdCBvbGRTb3J0S2V5Q29sdW1ucyA9IGdldFNvcnRLZXlDb2x1bW5zKG9sZFRhYmxlQ29sdW1ucyk7XG4gIGNvbnN0IG5ld1NvcnRLZXlDb2x1bW5zID0gZ2V0U29ydEtleUNvbHVtbnModGFibGVDb2x1bW5zKTtcbiAgY29uc3Qgb2xkU29ydFN0eWxlID0gb2xkUmVzb3VyY2VQcm9wZXJ0aWVzLnNvcnRTdHlsZTtcbiAgY29uc3QgbmV3U29ydFN0eWxlID0gdGFibGVBbmRDbHVzdGVyUHJvcHMuc29ydFN0eWxlO1xuICBpZiAoKG9sZFNvcnRTdHlsZSA9PT0gbmV3U29ydFN0eWxlICYmICFhcmVDb2x1bW5zRXF1YWwob2xkU29ydEtleUNvbHVtbnMsIG5ld1NvcnRLZXlDb2x1bW5zKSlcbiAgICB8fCAob2xkU29ydFN0eWxlICE9PSBuZXdTb3J0U3R5bGUpKSB7XG4gICAgc3dpdGNoIChuZXdTb3J0U3R5bGUpIHtcbiAgICAgIGNhc2UgVGFibGVTb3J0U3R5bGUuSU5URVJMRUFWRUQ6XG4gICAgICAgIC8vIElOVEVSTEVBVkVEIHNvcnQga2V5IGFkZGl0aW9uIHJlcXVpcmVzIHJlcGxhY2VtZW50LlxuICAgICAgICAvLyBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vcmVkc2hpZnQvbGF0ZXN0L2RnL3JfQUxURVJfVEFCTEUuaHRtbFxuICAgICAgICByZXR1cm4gY3JlYXRlVGFibGUodGFibGVOYW1lUHJlZml4LCB0YWJsZU5hbWVTdWZmaXgsIHRhYmxlQ29sdW1ucywgdGFibGVBbmRDbHVzdGVyUHJvcHMpO1xuXG4gICAgICBjYXNlIFRhYmxlU29ydFN0eWxlLkNPTVBPVU5EOiB7XG4gICAgICAgIGNvbnN0IHNvcnRLZXlDb2x1bW5zU3RyaW5nID0gZ2V0U29ydEtleUNvbHVtbnNTdHJpbmcobmV3U29ydEtleUNvbHVtbnMpO1xuICAgICAgICBhbHRlcmF0aW9uU3RhdGVtZW50cy5wdXNoKGBBTFRFUiBUQUJMRSAke3RhYmxlTmFtZX0gQUxURVIgJHtuZXdTb3J0U3R5bGV9IFNPUlRLRVkoJHtzb3J0S2V5Q29sdW1uc1N0cmluZ30pYCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjYXNlIFRhYmxlU29ydFN0eWxlLkFVVE86IHtcbiAgICAgICAgYWx0ZXJhdGlvblN0YXRlbWVudHMucHVzaChgQUxURVIgVEFCTEUgJHt0YWJsZU5hbWV9IEFMVEVSIFNPUlRLRVkgJHtuZXdTb3J0U3R5bGV9YCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGF3YWl0IFByb21pc2UuYWxsKGFsdGVyYXRpb25TdGF0ZW1lbnRzLm1hcChzdGF0ZW1lbnQgPT4gZXhlY3V0ZVN0YXRlbWVudChzdGF0ZW1lbnQsIHRhYmxlQW5kQ2x1c3RlclByb3BzKSkpO1xuXG4gIHJldHVybiB0YWJsZU5hbWU7XG59XG5cbmZ1bmN0aW9uIGdldFNvcnRLZXlDb2x1bW5zU3RyaW5nKHNvcnRLZXlDb2x1bW5zOiBDb2x1bW5bXSkge1xuICByZXR1cm4gc29ydEtleUNvbHVtbnMubWFwKGNvbHVtbiA9PiBjb2x1bW4ubmFtZSkuam9pbigpO1xufVxuIl19