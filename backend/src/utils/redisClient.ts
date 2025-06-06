import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const publisher = createClient({ url: redisUrl });
export const subscriber = createClient({ url: redisUrl });

export async function connectRedis() {
   try {
        if (!publisher.isOpen) {
            await publisher.connect();
        }
        if (!subscriber.isOpen) {
            await subscriber.connect();
        }
        console.log('✅ Both Redis clients connected successfully');
    } catch (error) {
        console.error('❌ Redis connection failed:', error);
        throw error;
    }
};
