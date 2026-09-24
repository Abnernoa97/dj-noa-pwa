import baseWorker, { ReminderScheduler } from './index';
import { handleDjNoaAssistant } from './djNoaAssistant';

export { ReminderScheduler };

type AiBinding = {
  run: (model: string, input: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
};

type Env = {
  AI: AiBinding;
  REMINDER_SCHEDULER: DurableObjectNamespace;
  ASSETS: Fetcher;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/assistant') {
      return handleDjNoaAssistant(request, env);
    }

    return baseWorker.fetch(request, env as never);
  }
} satisfies ExportedHandler<Env>;
