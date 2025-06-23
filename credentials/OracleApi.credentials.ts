import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class OracleApi implements ICredentialType {
	name = 'oracleCredentialsApi';
	displayName = 'Oracle Credentials API';

	documentationUrl = 'https://github.com/leandrolee/n8n-nodes-oracle-database-ai-tool/blob/master/README.md';

	properties: INodeProperties[] = [
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			default: '',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
      displayName: 'Connection String',
			name: 'connectionString',
			type: 'string',
			default: 'localhost/service_name',
    },
    {
      displayName: "Use Thin Mode?",
      name: "thinMode",
      type: "boolean",
      default: true,
      description: "Defines the type of connection to the database",
    },
	];
}
