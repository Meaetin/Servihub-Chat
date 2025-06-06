// PubSub message types
export enum PubSubChannels {
    CONVERSATION_PREFIX = 'chat:conversation:',
    NEW_MESSAGE = 'chat:new_message',
    TYPING_INDICATOR = 'chat:typing',
    PRESENCE = 'chat:presence',
    CONVERSATION_UPDATE = 'chat:conversation_update'    
};

// When a new message is sent
export interface MessageEvent {
    conversationId: string;
    senderId: string;
    body: string;
    timestamp: number;
    contentType: string;
}
  
// When user is typing
export interface TypingEvent {
    conversationId: string;
    userId: string;
    isTyping: boolean;
}
  
// When user is online or offline
export interface PresenceEvent {
    userId: string;
    status: 'online' | 'offline';
    lastSeen: number;
}