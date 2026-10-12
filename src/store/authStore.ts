import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Address, User } from "@/types";
import { generateId } from "@/lib/id";
import { hashPassword } from "@/lib/hash";

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthState {
  users: User[];
  currentUserId: string | null;
  seeded: boolean;
  seedDemoAccounts: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  currentUser: () => User | undefined;
  updateProfile: (patch: Partial<Pick<User, "name" | "email">>) => void;
  addAddress: (address: Address) => void;
  removeAddress: (index: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserId: null,
      seeded: false,

      seedDemoAccounts: async () => {
        if (get().seeded || get().users.length > 0) return;
        const [adminHash, demoHash] = await Promise.all([
          hashPassword("Admin123!"),
          hashPassword("Demo1234!"),
        ]);
        const now = new Date().toISOString();
        set({
          seeded: true,
          users: [
            {
              id: generateId("user"),
              name: "Store Admin",
              email: "admin@homenestkitchen.com",
              passwordHash: adminHash,
              role: "admin",
              addresses: [],
              createdAt: now,
            },
            {
              id: generateId("user"),
              name: "Jordan Rivera",
              email: "demo@homenestkitchen.com",
              passwordHash: demoHash,
              role: "customer",
              addresses: [
                {
                  fullName: "Jordan Rivera",
                  line1: "482 Maple Avenue",
                  city: "Austin",
                  state: "TX",
                  postalCode: "73301",
                  country: "United States",
                  phone: "+1 (512) 555-0133",
                },
              ],
              createdAt: now,
            },
          ],
        });
      },

      register: async (name, email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (get().users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
          return { success: false, error: "An account with this email already exists." };
        }
        if (password.length < 8) {
          return { success: false, error: "Password must be at least 8 characters." };
        }
        const passwordHash = await hashPassword(password);
        const user: User = {
          id: generateId("user"),
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "customer",
          addresses: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ users: [...state.users, user], currentUserId: user.id }));
        return { success: true };
      },

      login: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const user = get().users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (!user) return { success: false, error: "No account found with this email." };
        const passwordHash = await hashPassword(password);
        if (passwordHash !== user.passwordHash) {
          return { success: false, error: "Incorrect password. Please try again." };
        }
        set({ currentUserId: user.id });
        return { success: true };
      },

      logout: () => set({ currentUserId: null }),

      currentUser: () => get().users.find((u) => u.id === get().currentUserId),

      updateProfile: (patch) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === state.currentUserId ? { ...u, ...patch } : u,
          ),
        })),

      addAddress: (address) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === state.currentUserId ? { ...u, addresses: [...u.addresses, address] } : u,
          ),
        })),

      removeAddress: (index) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === state.currentUserId
              ? { ...u, addresses: u.addresses.filter((_, i) => i !== index) }
              : u,
          ),
        })),
    }),
    { name: "hnk-auth" },
  ),
);
