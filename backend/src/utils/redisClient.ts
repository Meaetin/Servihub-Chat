import { createClient } from 'redis';

export const publisher = createClient();
export const subscriber = createClient();

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
