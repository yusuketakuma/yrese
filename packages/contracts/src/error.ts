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
