import { publisher, subscriber } from '../utils/redisClient';
import { PubSubChannels, MessageEvent, TypingEvent, PresenceEvent } from '../types/pubsub';

export class PubSubService {
  // Publish a new message to a conversation channel
  async publishMessage(event: MessageEvent) {
    await publisher.publish(
      PubSubChannels.NEW_MESSAGE, 
      JSON.stringify(event)
    );
  }

  // Publish typing indicator
  async publishTypingIndicator(event: TypingEvent) {
    await publisher.publish(
      PubSubChannels.TYPING_INDICATOR, 
      JSON.stringify(event)
    );
  }

  // Publish user presence
  async publishPresence(event: PresenceEvent) {
    await publisher.publish(
      PubSubChannels.PRESENCE, 
      JSON.stringify(event)
    );
  }

  // Subscribe to message events
  async subscribeToMessages(callback: (message: MessageEvent) => void) {
    await subscriber.subscribe(
      PubSubChannels.NEW_MESSAGE, 
      (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      }
    );
  }

  // Subscribe to typing events
  async subscribeToTyping(callback: (typing: TypingEvent) => void) {
    await subscriber.subscribe(
      PubSubChannels.TYPING_INDICATOR, 
      (typing) => {
        try {
          const parsedTyping = JSON.parse(typing);
          callback(parsedTyping);
        } catch (error) {
          console.error('Failed to parse typing event:', error);
        }
      }
    );
  }

  // Subscribe to presence events
  async subscribeToPresence(callback: (presence: PresenceEvent) => void) {
    await subscriber.subscribe(
      PubSubChannels.PRESENCE, 
      (presence) => {
        try {
          const parsedPresence = JSON.parse(presence);
          callback(parsedPresence);
        } catch (error) {
          console.error('Failed to parse presence event:', error);
        }
      }
    );
  }

  // Subscribe to a specific conversation channel
  async subscribeToConversation(conversationId: string, callback: (message: MessageEvent) => void) {
    const channel = `${PubSubChannels.CONVERSATION_PREFIX}${conversationId}`;
    await subscriber.subscribe(channel, (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    });
  }

  // Publish to a specific conversation channel
  async publishToConversation(conversationId: string, event: MessageEvent) {
    const channel = `${PubSubChannels.CONVERSATION_PREFIX}${conversationId}`;
    try {
        await publisher.publish(channel, JSON.stringify(event));
    } catch (error) {
        console.error('Failed to publish to conversation:', error);
    }
  }

  // Unsubscribe from a specific conversation channel
  async unsubscribeFromConversation(conversationId: string) {
    const channel = `${PubSubChannels.CONVERSATION_PREFIX}${conversationId}`;
    try {
        await subscriber.unsubscribe(channel);
    } catch (error) {
        console.error('Failed to unsubscribe from conversation:', error);
    }
  }

  // Unsubscribe from all channels
  async unsubscribeAll() {
    await subscriber.unsubscribe();
  }
}

export const pubSubService = new PubSubService();
