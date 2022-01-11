export interface WhatsAppMessageRawPayload {
  id: string, // ID that represents the contact
  isBlocked: boolean, // Indicates if you have blocked this contact
  isBusiness: boolean, // Indicates if the contact is a business contact
  isEnterprise: boolean, // Indicates if the contact is an enterprise contact
  isGroup: boolean, // Indicates if the contact is a group contact
  isMe: boolean, // Indicates if the contact is the current user's contact
  isMyContact: boolean, // Indicates if the number is saved in the current phone's contacts
  isUser: boolean, // Indicates if the contact is a user contact
  isWAContact: boolean, // Indicates if the number is registered on WhatsApp
  name?: string, // The contact's name, as saved by the current user
  number: string, // Contact's phone number
  pushname: string, // The name that the contact has configured to be shown publically
  shortName?: string, // A shortened version of name
}
