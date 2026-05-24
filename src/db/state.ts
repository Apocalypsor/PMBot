import { DurableObject } from "cloudflare:workers";
import type { VerifiedUserRecord } from "@/types";

const RECENT_VERIFICATION_TTL_MS = 10 * 60 * 1000;

type StateSetBody = {
  expiresAt?: number;
  key?: string;
  value?: unknown;
};

type StateKeyBody = {
  key?: string;
};

type StateGetResult = {
  exists?: boolean;
  value?: unknown;
};

type ExpiringStateValue = {
  expiresAt: number;
  value: unknown;
};

export class PMBotState extends DurableObject<Env> {
  fetch = async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ ok: false }, { status: 405 });
    }

    const path = new URL(request.url).pathname;
    if (path === "/set") {
      const body = (await request.json()) as StateSetBody;
      if (!body.key) return Response.json({ ok: false }, { status: 400 });

      await this.ctx.storage.put(
        body.key,
        typeof body.expiresAt === "number"
          ? { value: body.value ?? true, expiresAt: body.expiresAt }
          : (body.value ?? true),
      );
      return Response.json({ ok: true });
    }

    if (path === "/get") {
      const body = (await request.json()) as StateKeyBody;
      if (!body.key) return Response.json({ ok: false }, { status: 400 });

      const value = await this.ctx.storage.get(body.key);
      if (isExpiredStateValue(value)) {
        await this.ctx.storage.delete(body.key);
        return Response.json({ ok: true, exists: false });
      }

      const resolvedValue = isExpiringStateValue(value) ? value.value : value;
      return Response.json({
        ok: true,
        exists: resolvedValue !== undefined,
        value: resolvedValue,
      });
    }

    return Response.json({ ok: false }, { status: 404 });
  };
}

export const putVerifiedUserState = async (
  env: Env,
  key: string,
  record: VerifiedUserRecord,
): Promise<void> => {
  await setState(env, key, record, Date.now() + RECENT_VERIFICATION_TTL_MS);
};

export const hasVerifiedUserState = async (
  env: Env,
  key: string,
): Promise<boolean> => {
  return hasState(env, key);
};

const getStateObject = (env: Env): DurableObjectStub => {
  const id = env.PMBOT_STATE.idFromName("pmbot-state");
  return env.PMBOT_STATE.get(id);
};

const setState = async (
  env: Env,
  key: string,
  value: unknown,
  expiresAt?: number,
): Promise<void> => {
  const response = await getStateObject(env).fetch("https://state/set", {
    method: "POST",
    body: JSON.stringify({ expiresAt, key, value }),
  });

  if (!response.ok) {
    throw new Error(`State set failed: ${response.status}`);
  }
};

const hasState = async (env: Env, key: string): Promise<boolean> => {
  const result = await getState(env, key);
  return result.exists === true;
};

const getState = async (env: Env, key: string): Promise<StateGetResult> => {
  const response = await getStateObject(env).fetch("https://state/get", {
    method: "POST",
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    throw new Error(`State read failed: ${response.status}`);
  }

  return response.json() as Promise<StateGetResult>;
};

const isExpiringStateValue = (value: unknown): value is ExpiringStateValue => {
  return (
    typeof value === "object" &&
    value !== null &&
    "expiresAt" in value &&
    typeof value.expiresAt === "number" &&
    "value" in value
  );
};

const isExpiredStateValue = (value: unknown): boolean => {
  return isExpiringStateValue(value) && value.expiresAt <= Date.now();
};
