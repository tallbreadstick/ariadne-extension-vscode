/**
 * Keeps a warm Copilot SDK client running to avoid cold-start latency on
 * every AI feedback request (~5–10 s saved per call).
 */

import type { CopilotRuntimeOptions } from './copilotRuntime.js';
import { createCopilotClient } from './copilotRuntime.js';

type ManagedClient = Awaited<ReturnType<typeof createCopilotClient>>;

export class CopilotClientManager {
	private client?: ManagedClient;
	private startPromise?: Promise<ManagedClient>;
	private runtimeKey?: string;

	private runtimeKeyFor(options: CopilotRuntimeOptions): string {
		return `${options.gitHubToken}:${options.copilotHome}:${options.extensionPath}`;
	}

	async getClient(options: CopilotRuntimeOptions): Promise<ManagedClient> {
		const key = this.runtimeKeyFor(options);

		if (this.client && this.runtimeKey === key) {
			return this.client;
		}

		if (this.startPromise && this.runtimeKey === key) {
			return this.startPromise;
		}

		await this.dispose();

		this.runtimeKey = key;
		this.startPromise = (async () => {
			const client = await createCopilotClient(options);
			await client.start();
			this.client = client;
			return client;
		})();

		try {
			return await this.startPromise;
		} finally {
			this.startPromise = undefined;
		}
	}

	/** Starts the client in the background so the first Ask Ariadne is faster. */
	prewarm(options: CopilotRuntimeOptions): void {
		void this.getClient(options).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			console.warn('[Ariadne] Copilot prewarm failed:', message);
		});
	}

	async dispose(): Promise<void> {
		const client = this.client;
		this.client = undefined;
		this.runtimeKey = undefined;
		this.startPromise = undefined;

		if (client) {
			await client.stop().catch(() => undefined);
		}
	}
}
