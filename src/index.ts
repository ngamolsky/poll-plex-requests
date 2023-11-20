import { getAllPlexRequestsWithEmail } from './notion';

export interface Env {
	NOTION_INTEGRATION_KEY: string;
	NOTION_PLEX_REQUEST_DATABASE_ID: string;

	PLEX_REQUESTS: KVNamespace;

	SEND_EMAIL: Fetcher;
}

const DONE_STATUS = 'Done';
const NOT_FOUND_STATUS = 'Not Found';
const SEND_EMAIL_WORKER_URL = 'https://send-email.ng-cloudflare.workers.dev/';
const GIPHY_DONE_URLS = [
	'https://media.giphy.com/media/EqjqXkrEb9XNEJam1A/giphy.gif',
	'https://media.giphy.com/media/vcchz3ewKCh6Jom9Dg/giphy.gif',
	'https://media.giphy.com/media/HuG4jDKo38YJW/giphy.gif',
];
const GIPHY_FAILED_URLS = ['https://media.giphy.com/media/pVBUBqNdTdsVuiybM4/giphy.gif'];

export default {
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const requests = await getAllPlexRequestsWithEmail(env.NOTION_INTEGRATION_KEY, env.NOTION_PLEX_REQUEST_DATABASE_ID);

		for (const request of requests) {
			const email = request.email;
			const title = request.title;
			const who = request.who;
			const newStatus = request.status;
			const id = request.id;

			// Check if the record exists in KV

			const requestKey = `${email}-${title}-${id}`;
			const oldStatus = await env.PLEX_REQUESTS.get(requestKey);

			if (oldStatus) {
				console.log(`Found plex request in KV. Title: ${title} - Old Status: ${oldStatus} - New Status: ${newStatus} - Email: ${email}`);

				// If it does check if the status has changed
				if (oldStatus !== newStatus) {
					await env.PLEX_REQUESTS.put(requestKey, newStatus);
					console.log(`Updated plex request in KV. Title: ${title} - Old Status: ${oldStatus} - Status: ${newStatus} - Email: ${email} `);

					// If its now "Done" send an email to recorded address
					if (newStatus === DONE_STATUS) {
						await sendRequestCompletedEmail(env, email, title, who);
					} else if (newStatus === NOT_FOUND_STATUS) {
						// If its now "Not Found" send an email to recorded address
						await sendRequestNotFoundEmail(env, email, title, who);
					}
				}
			} else {
				await env.PLEX_REQUESTS.put(requestKey, newStatus);
				console.log(`Added plex request to KV. Title: ${title} - Status: ${newStatus} - Email: ${email} `);

				// If it doesn't exist and was created in Done status, send an email immediately
				if (newStatus === DONE_STATUS) {
					await sendRequestCompletedEmail(env, email, title, who);
				} else if (newStatus === NOT_FOUND_STATUS) {
					// If it doesn't exist and was created in Not Found status, send an email immediately
					await sendRequestNotFoundEmail(env, email, title, who);
				}
			}
		}
	},
};

const sendRequestCompletedEmail = async (env: Env, email: string, title: string, who: string) => {
	// Choose a random success gif
	const gifUrl = GIPHY_DONE_URLS[Math.floor(Math.random() * GIPHY_DONE_URLS.length)];

	const subject = `🙌 Plex Request "${title}" is now ready 🙌`;
	const html = `<p>Hi ${who}!</p><p>Nikita has been working tirelessly to make sure your Plex request <strong>${title}</strong> is ready for you.</p><p>Make sure to compliment his skills and enjoy!</p><img src="${gifUrl}" />`;

	await env.SEND_EMAIL.fetch(
		new Request(SEND_EMAIL_WORKER_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				toEmail: email,
				subject: subject,
				html: html,
			}),
		})
	);

	console.log(`Sent success email to ${email} for ${title}`);
};

const sendRequestNotFoundEmail = async (env: Env, email: string, title: string, who: string) => {
	// Choose a random failure gif
	const gifUrl = GIPHY_FAILED_URLS[Math.floor(Math.random() * GIPHY_FAILED_URLS.length)];

	const subject = `🤷‍♂️ Plex Request "${title}" not found 🤷‍♂️`;
	const html = `<p>Hi ${who}!</p><p>Unfortunately Nikita was unable to find your Plex request <strong>${title}</strong>.</p><p>It's probably due to it being hard to pirate either due to rarity or lawyers</p><p>So Sorry!</p><img src="${gifUrl}" />`;

	await env.SEND_EMAIL.fetch(
		new Request(SEND_EMAIL_WORKER_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				toEmail: email,
				subject: subject,
				html: html,
			}),
		})
	);

	console.log(`Sent failure email to ${email} for ${title}`);
};
