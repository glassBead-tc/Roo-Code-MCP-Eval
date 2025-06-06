/**
 * Semantic convention constants for MCP tracing.
 * These are copied from @opentelemetry/semantic-conventions/incubating
 * to avoid breaking changes in minor versions.
 */

// RPC attributes (from incubating)
export const ATTR_RPC_SYSTEM = "rpc.system" as const
export const ATTR_RPC_SERVICE = "rpc.service" as const
export const ATTR_RPC_METHOD = "rpc.method" as const

// Service resource attributes (from stable)
export const ATTR_SERVICE_NAME = "service.name" as const
export const ATTR_SERVICE_VERSION = "service.version" as const
