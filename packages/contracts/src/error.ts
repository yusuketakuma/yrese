import { createKernelErrorCodeRegistry, isValidErrorCode } from "@yrese/shared-kernel";
import { z } from "zod";

const errorCodeRegistry = createKernelErrorCodeRegistry();

export const errorResponseSchema = z.object({
  errorCode: z
    .string()
    .min(1)
    .refine(isValidErrorCode, {
      message: "errorCode must match the error code format",
    })
    .refine((code) => errorCodeRegistry.get(code) !== undefined, {
      message: "errorCode must be registered in the error code registry",
    }),
  message: z.string().min(1),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * WP-9008: framework 正規化エラー応答の契約形。
 *
 * 到達可能な実挙動は3系statusで、いずれも定数化された安全文字列だけを運ぶ
 * (raw 例外・PHI 非含有):
 * - 400: JSON body parse 失敗(Fastify content-type parser。`code` あり)
 * - 404: 未知ルート
 * - 500: 正規化 internal error(handler 側で invariant message へ正規化済み)
 */
export const frameworkErrorResponseSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().min(1).optional(),
  error: z.string().min(1),
  message: z.string().min(1),
});

export type FrameworkErrorResponse = z.infer<typeof frameworkErrorResponseSchema>;
