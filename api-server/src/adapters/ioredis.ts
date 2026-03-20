import type Redis from 'ioredis'
import { RedisPort } from "../core/ports";

export function makeRedisAdapter(redis: Redis): RedisPort {
   return {
      set: (key, value, mode, ttlSeconds) => redis.set(key, value, mode, ttlSeconds)
   }
}