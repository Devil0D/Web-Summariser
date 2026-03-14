import {
  createContext,
  useState,
  useEffect,
  useContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { checkAuthStatus } from "../services/authService";
import {
  getFolders,
  createFolders as createFoldersAPI,
  deleteFolders as deleteFolderAPI,
} from "@/services/folderService";
import { getConversations } from "@/services/conversationService";
import { deleteConversation as deleteConversationAPI } from "@/services/conversationService";

interface Conversation {
  ID: number;
  id: number;
  title: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
}
interface User {
  ID: number;
  Username: string;
  Email: string;
}
interface Folder {
  ID: number;
  Folder_Name: string;
  userID: number;
}

export type AiModel =
  | "gemini-2.0-flash"
  | "gemini-1.5-flash"
  | "gemini-1.5-flash-8b"
  | "gemini-1.5-pro";

export interface AiSettings {
  apiKey: string;
  preferredModel: AiModel;
}

const AI_SETTINGS_STORAGE_KEY = "websears.ai-settings";
const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: "",
  preferredModel: "gemini-2.0-flash",
};

function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_AI_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      apiKey: parsed.apiKey ?? DEFAULT_AI_SETTINGS.apiKey,
      preferredModel:
        (parsed.preferredModel as AiModel | undefined) ??
        DEFAULT_AI_SETTINGS.preferredModel,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  folders: Folder[];
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: number) => Promise<void>;
  conversations: Conversation[];
  addConversation: (newConversation: Conversation) => void;
  deleteConversation: (id: number) => Promise<void>;
  activeConversationId: number | null;
  selectConversation: (id: number | null) => void;
  setUser: Dispatch<SetStateAction<User | null>>;
  aiSettings: AiSettings;
  updateAiSettings: (settings: AiSettings) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => loadAiSettings());
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const initializeAppData = async () => {
      try {
        const authResponse = await checkAuthStatus();
        setUser(authResponse.user);

        const [foldersResponse, conversationsResponse] = await Promise.all([
          getFolders(),
          getConversations(),
        ]);
        setFolders(foldersResponse);
        setConversations(conversationsResponse);
      } catch (err: any) {
        setUser(null);
        setFolders([]);
        setConversations([]);
      } finally {
        setLoading(false);
      }
    };
    initializeAppData();
  }, []);

  const createFolder = async (name: string) => {
    try {
      const newFolder = await createFoldersAPI(name);
      setFolders((currentFolders) => [...currentFolders, newFolder]);
    } catch (error) {
      console.error("Failed to create Folder", error);
    }
  };

  const deleteFolder = async (id: number) => {
    try {
      await deleteFolderAPI(id);
      setFolders((currentFolders) =>
        currentFolders.filter((folder) => folder.ID !== id)
      );
    } catch (error: any) {
      console.log("Failed to create a Folder", error);
    }
  };

  const selectConversation = (id: number | null) => {
    setActiveConversationId(id);
  };

  const addConversation = (newConversation: Conversation) => {
    setConversations((prev) => [newConversation, ...prev]);
  };

  const deleteConversation = async (id: number) => {
    try {
      await deleteConversationAPI(id);

      setConversations((currentConversations) =>
        currentConversations.filter((conversations) => conversations.ID !== id)
      );
    } catch (error) {
      console.log("Failed to delete conversation", error);
    }
  };

  const updateAiSettings = (settings: AiSettings) => {
    setAiSettings(settings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        setUser,
        folders,
        createFolder,
        deleteFolder,
        conversations,
        addConversation,
        selectConversation,
        activeConversationId,
        deleteConversation,
        aiSettings,
        updateAiSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("UseAuth must be used within the auth provider");
  }
  return context;
};
