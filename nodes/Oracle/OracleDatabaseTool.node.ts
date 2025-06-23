import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import oracledb from 'oracledb';
import { OracleConnection } from './core/connection';

export class OracleDatabaseTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Oracle Database',
		name: 'oracleDatabaseTool',
		icon: 'file:oracle.svg',
		group: ['input'],
		version: 1,
		description: 'Performs operations and queries on an Oracle database',
		defaults: {
			name: 'Oracle Database',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [
      {
        name: 'oracleCredentialsApi',
        required: true,
      },
    ],
		properties: [
			{
				displayName: 'SQL Statement',
				name: 'statement',
				type: 'string',
				typeOptions: {
        	alwaysOpenEditWindow: true,
        },
				default: '',
				placeholder: 'SELECT id, name FROM product WHERE id < :param_name',
				required: true,
				description: 'The SQL statement to execute',
			},
			{
				displayName: 'Parameters',
				name: 'parameters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add another parameter',
					multipleValues: true,
				},
				default: {},
				options: [
          {
            displayName: 'Values',
						name: 'values',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								placeholder: 'e.g.: param_name',
								required: true,
								hint: 'Do not start with ":"',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'e.g.: 12345',
								required: true,
							},
							{
								displayName: 'Data Type',
								name: 'datatype',
								type: 'options',
								required: true,
								default: 'string',
								options: [
									{ name: 'String', value: 'string' },
									{ name: 'Number', value: 'number' },
								],
							},
							{
								displayName: 'Parse for IN Statement',
								name: 'parseInStatement',
								type: 'options',
								required: true,
								default: false,
								hint: 'If "Yes" the "Value" field should be a string of comma-separated values. i.e: 1,2,3 or str1,str2,str3',
								options: [
									{ name: 'No', value: false },
									{ name: 'Yes', value: true },
								],
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		if (typeof String.prototype.replaceAll === 'undefined') {
			String.prototype.replaceAll = function(match: string, replace: string): string {
				const escapedMatch = match.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
				const regex = new RegExp(escapedMatch, 'g');
				return this.replace(regex, replace);
			};
		}

		const credentials = await this.getCredentials('oracleCredentialsApi');

		const oracleCredentials = {
			user: String(credentials.user),
			password: String(credentials.password),
			connectionString: String(credentials.connectionString),
		};

		const db = new OracleConnection(
			oracleCredentials,
			Boolean(credentials.thinMode)
		);

		const connection = await db.getConnection();

		let returnItems = [];

		try {
			let statement = this.getNodeParameter('statement', 0) as string;
			const parameterIDataObjectList = ((this.getNodeParameter('parameters', 0, {}) as IDataObject).values as { name: string, value: string | number, datatype: string, parseInStatement: boolean }[]) || [];

			const bindParameters: { [key: string]: oracledb.BindParameter } = parameterIDataObjectList.reduce((result: { [key: string]: oracledb.BindParameter }, item) => {
				let datatype: oracledb.DbType | undefined = undefined;
				if (item.datatype && item.datatype === 'number') {
					datatype = oracledb.NUMBER;
				} else {
					datatype = oracledb.STRING;
				}

				if (!item.parseInStatement) {
					result[item.name] = { type: datatype, val: item.datatype && item.datatype === 'number' ? Number(item.value) : String(item.value) };
					return result;
				} else {
					const valList = item.value.toString().split(',');
					let generatedSqlString = '(';
					const crypto = require('crypto');
					for (let i = 0; i < valList.length; i++) {
						const uniqueId: String = crypto.randomUUID().replaceAll('-', '_');
						const newParamName = item.name + uniqueId;
						result[newParamName] = { type: datatype, val: item.datatype && item.datatype === 'number' ? Number(valList[i]) : String(valList[i]) };
						generatedSqlString += `:${newParamName},`
					}

					generatedSqlString = generatedSqlString.slice(0, -1) + ')';
					statement = statement.replaceAll(`:${item.name}`, generatedSqlString);
					return result;
				}
			}, {});

			const result = await connection.execute(
				statement,
				bindParameters,
				{
					outFormat: oracledb.OUT_FORMAT_OBJECT,
					autoCommit: true,
				},
			);

			returnItems = this.helpers.returnJsonArray(
				result as unknown as IDataObject[]
			);

		} catch (error) {
			throw new NodeOperationError(this.getNode(), error.message);
		} finally {
			if (connection) {
				try {
					await connection.close();
				} catch (error) {
					console.error(
						`OracleDB: Failed to close the database connection: ${error}`
					);
				}
			}
		}

		return this.prepareOutputData(returnItems);
	}
}

declare global {
	interface String {
		replaceAll(match: string , replace: string): string;
	}
}
