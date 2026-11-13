import { UserData } from "../models/users";

export interface DMChannelData {
    id: string;
    type: 1;
    recipient: UserData;
    lastMessageId?: string | null;
}

export interface GroupDMChannelData {
    id: string;
    type: 3;
    name?: string | null;
    icon?: string | null;
    ownerId: string;
    recipients: UserData[];
    lastMessageId?: string | null;
    applicationId?: string | null;
}