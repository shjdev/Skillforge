import { create } from 'zustand';

export interface UserProfileState {
  id: string;
  name: string;
  sessionMode: 'TWO_SESSIONS' | 'ONE_SESSION';
  morningTime: string;
  eveningTime: string;
  singleSessionTime: string;
  currentActiveDomainId: string | null;
  currentActiveTopicId: string | null;
  totalXp: number;
  currentStreak: number;
}

interface AppStore {
  userProfile: UserProfileState | null;
  setUserProfile: (profile: UserProfileState) => void;
  updateActiveLock: (domainId: string | null, topicId: string | null) => void;
  addXp: (amount: number) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),
  updateActiveLock: (domainId, topicId) =>
    set((state) => ({
      userProfile: state.userProfile
        ? {
            ...state.userProfile,
            currentActiveDomainId: domainId,
            currentActiveTopicId: topicId,
          }
        : null,
    })),
  addXp: (amount) =>
    set((state) => ({
      userProfile: state.userProfile
        ? {
            ...state.userProfile,
            totalXp: state.userProfile.totalXp + amount,
          }
        : null,
    })),
}));
