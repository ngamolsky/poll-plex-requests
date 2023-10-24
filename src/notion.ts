import { Client } from '@notionhq/client';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export const getAllPlexRequestsWithEmail = async (apiKey: string, databaseId: string) => {
	const notion = new Client({ auth: apiKey });

	const response = await notion.databases.query({
		database_id: databaseId,
		filter: {
			property: 'Email',
			email: {
				is_not_empty: true,
			},
		},
	});

	const results = response.results as PageObjectResponse[];

	const processedResults = results.map((result) => {
		const properties = result.properties as any;

		return {
			id: result.id,
			email: properties.Email.email,
			who: properties['Who is this?'].rich_text[0].plain_text,
			title: properties['What should I add?'].title[0].plain_text,
			status: properties.Status.status.name,
		};
	});

	return processedResults;
};
