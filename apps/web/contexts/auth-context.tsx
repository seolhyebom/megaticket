"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

// --- Interfaces ---

export interface User {
    id: string
    email: string
    name: string
}

export interface AuthService {
    login(email: string, password: string): Promise<User>
    signup(email: string, password: string, name: string): Promise<User>
    logout(): Promise<void>
}

// --- Mock Service Implementation ---

const MOCK_USER_STORAGE_KEY = "megaticket-auth-user"

export const mockAuthService: AuthService = {
    async login(email, password): Promise<User> {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500))

        throw new Error("Invalid credentials")
    },

    async signup(email, password, name): Promise<User> {
        await new Promise((resolve) => setTimeout(resolve, 500))

        const user: User = {
            id: "mock-user-" + Math.random().toString(36).substr(2, 9),
            email: email,
            name: name,
        }
        return user
    },

    async logout(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 200))
    },
}

// --- Context & Provider ---

interface AuthContextType {
    user: User | null
    isLoading: boolean
    login: (email: string, password: string) => Promise<void>
    signup: (email: string, password: string, name: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Load user from localStorage on mount (Client-side only)
    useEffect(() => {
        const loadUser = () => {
            try {
                const stored = localStorage.getItem(MOCK_USER_STORAGE_KEY)
                if (stored) {
                    setUser(JSON.parse(stored))
                }
            } catch (e) {
                console.error("Failed to load user from storage", e)
            } finally {
                setIsLoading(false)
            }
        }
        loadUser()
    }, [])

    const login = async (email: string, password: string) => {
        try {
            const config = (window as any).__PLCR_CONFIG__;
            if (config?.AUTH_PROVIDER !== 'mock') {
                // Real API
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || '로그인 실패');
                setUser(result.user);
                // 토큰 저장 로직 등은 생략하거나 필요한 경우 추가
                if (result.token) localStorage.setItem('auth-token', result.token);
                // 유저 정보 저장 (새로고침 유지용)
                localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(result.user));
            } else {
                // Mock
                const user = await mockAuthService.login(email, password);
                setUser(user);
                localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(user));
            }
        } catch (error) {
            throw error;
        }
    }

    const signup = async (email: string, password: string, name: string) => {
        try {
            const config = (window as any).__PLCR_CONFIG__;
            if (config?.AUTH_PROVIDER !== 'mock') {
                // Real API
                const res = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, name }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || '회원가입 실패');

                // 가입 후 자동 로그인 처리 or 로그인 페이지 이동
                // 여기서는 로그인 페이지 이동 유도를 위해 아무것도 안 함 (호출측에서 처리)
            } else {
                // Mock
                const user = await mockAuthService.signup(email, password, name);
                setUser(user);
                localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify(user));
            }
        } catch (error) {
            throw error;
        }
    }

    const logout = async () => {
        try {
            await mockAuthService.logout()
            setUser(null)
            localStorage.removeItem(MOCK_USER_STORAGE_KEY)
        } catch (error) {
            console.error("Logout failed", error)
        }
    }

    return (
        <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

// --- Hook ---

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
