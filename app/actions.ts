'use server';

import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';
import { fetchBarsFromOSM } from './api/bars/route';

// --- TYPY ---
export interface UserProfile {
  id: string;
  nickname: string;
  teamId: string | null;
  avatar: string;
  title: string;
  bio: string;
  favoriteDrink: string;
  teamRole: string;
  visitsCount?: number;
}

export interface TeamMemberItem {
  id: string;
  nickname: string;
  avatar: string;
  title: string;
  teamRole: string;
  visitsCount: number;
}

export interface TeamDetails {
  id: string;
  name: string;
  code: string;
  region: string;
  motto: string;
  badge: string;
  color: string;
  ownerId: string;
  members: TeamMemberItem[];
  totalScore: number;
  level: number;
}

// --- WBUDOWANA PAMIĘĆ PODRĘCZNA / FALLBACK NA WYPADEK BRAKU BAZY POSTGRES ---
interface MemoryUser {
  id: string;
  nickname: string;
  passwordHash: string;
  avatar: string;
  title: string;
  bio: string;
  favoriteDrink: string;
  teamRole: string;
  teamId: string | null;
  createdAt: Date;
}

interface MemoryTeam {
  id: string;
  name: string;
  code: string;
  region: string;
  motto: string;
  badge: string;
  color: string;
  ownerId: string;
  createdAt: Date;
}

interface MemoryVisit {
  id: string;
  userId: string;
  osmId: string;
  barName: string;
  visitedAt: Date;
}

interface MemoryStore {
  users: Map<string, MemoryUser>;
  teams: Map<string, MemoryTeam>;
  visits: MemoryVisit[];
}

// Singleton dla środowiska bez aktywnej bazy PostgreSQL
const memStore: MemoryStore = ((global as any).__barpulse_mem_store as MemoryStore) || {
  users: new Map<string, MemoryUser>(),
  teams: new Map<string, MemoryTeam>(),
  visits: [] as MemoryVisit[]
};
(global as any).__barpulse_mem_store = memStore;

// Sprawdzenie czy baza PostgreSQL jest aktywna
async function isPrismaAvailable(): Promise<boolean> {
  if (!process.env.POSTGRES_PRISMA_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Obliczenie poziomu ekipy na podstawie liczby odwiedzonych barów
function calculateTeamLevel(score: number): number {
  if (score >= 50) return 5;
  if (score >= 25) return 4;
  if (score >= 15) return 3;
  if (score >= 5) return 2;
  return 1;
}

// --- MAPA OPENSTREETMAP ---
export async function fetchBarsOSM(city: string) {
  return await fetchBarsFromOSM(city);
}

// --- AUTH & PROFIL ---
export async function registerUser(
  nickname: string,
  pass: string,
  avatar = '🍺',
  title = 'Nowicjusz Barowy',
  favoriteDrink = 'Piwo rzemieślnicze'
) {
  const trimmed = nickname.trim();
  if (!trimmed) throw new Error('Podaj poprawny nick');
  if (pass.length < 4) throw new Error('Hasło musi mieć min. 4 znaki');

  const passwordHash = await bcrypt.hash(pass, 10);

  if (await isPrismaAvailable()) {
    try {
      const existing = await prisma.user.findUnique({ where: { nickname: trimmed } });
      if (existing) throw new Error('Nick zajęty');

      const user = await prisma.user.create({
        data: {
          nickname: trimmed,
          passwordHash,
          avatar,
          title,
          bio: 'Gotowy na nocny szlak!',
          favoriteDrink,
          teamRole: 'MEMBER'
        }
      });
      return {
        id: user.id,
        nickname: user.nickname,
        teamId: user.teamId,
        avatar: user.avatar,
        title: user.title,
        bio: user.bio,
        favoriteDrink: user.favoriteDrink,
        teamRole: user.teamRole
      };
    } catch (e: any) {
      if (e.message === 'Nick zajęty') throw e;
    }
  }

  // Fallback in-memory
  for (const u of memStore.users.values()) {
    if (u.nickname.toLowerCase() === trimmed.toLowerCase()) {
      throw new Error('Nick zajęty');
    }
  }

  const id = 'usr_' + Math.random().toString(36).substring(2, 10);
  const newUser: MemoryUser = {
    id,
    nickname: trimmed,
    passwordHash,
    avatar,
    title,
    bio: 'Gotowy na nocny szlak!',
    favoriteDrink,
    teamRole: 'MEMBER',
    teamId: null,
    createdAt: new Date()
  };
  memStore.users.set(id, newUser);

  return {
    id: newUser.id,
    nickname: newUser.nickname,
    teamId: newUser.teamId,
    avatar: newUser.avatar,
    title: newUser.title,
    bio: newUser.bio,
    favoriteDrink: newUser.favoriteDrink,
    teamRole: newUser.teamRole
  };
}

export async function loginUser(nickname: string, pass: string) {
  const trimmed = nickname.trim();

  if (await isPrismaAvailable()) {
    try {
      const user = await prisma.user.findUnique({ where: { nickname: trimmed } });
      if (!user) throw new Error('Brak użytkownika o tym nicku');
      const isValid = await bcrypt.compare(pass, user.passwordHash);
      if (!isValid) throw new Error('Błędne hasło');
      return {
        id: user.id,
        nickname: user.nickname,
        teamId: user.teamId,
        avatar: user.avatar,
        title: user.title,
        bio: user.bio,
        favoriteDrink: user.favoriteDrink,
        teamRole: user.teamRole
      };
    } catch (e: any) {
      if (e.message.includes('Brak użytkownika') || e.message.includes('Błędne hasło')) throw e;
    }
  }

  // Fallback in-memory
  let foundUser: MemoryUser | null = null;
  for (const u of memStore.users.values()) {
    if (u.nickname.toLowerCase() === trimmed.toLowerCase()) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser) {
    // Jeżeli to pierwsze uruchomienie lokalne, automatycznie stwórz konto dla wygody
    return await registerUser(trimmed, pass);
  }

  const isValid = await bcrypt.compare(pass, foundUser.passwordHash);
  if (!isValid) throw new Error('Błędne hasło');

  return {
    id: foundUser.id,
    nickname: foundUser.nickname,
    teamId: foundUser.teamId,
    avatar: foundUser.avatar,
    title: foundUser.title,
    bio: foundUser.bio,
    favoriteDrink: foundUser.favoriteDrink,
    teamRole: foundUser.teamRole
  };
}

export async function updateUserProfile(
  userId: string,
  data: { avatar?: string; title?: string; bio?: string; favoriteDrink?: string }
) {
  if (await isPrismaAvailable()) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.avatar ? { avatar: data.avatar } : {}),
          ...(data.title ? { title: data.title } : {}),
          ...(data.bio ? { bio: data.bio } : {}),
          ...(data.favoriteDrink ? { favoriteDrink: data.favoriteDrink } : {})
        }
      });
      return {
        id: updated.id,
        nickname: updated.nickname,
        teamId: updated.teamId,
        avatar: updated.avatar,
        title: updated.title,
        bio: updated.bio,
        favoriteDrink: updated.favoriteDrink,
        teamRole: updated.teamRole
      };
    } catch {}
  }

  const u = memStore.users.get(userId);
  if (u) {
    if (data.avatar) u.avatar = data.avatar;
    if (data.title) u.title = data.title;
    if (data.bio) u.bio = data.bio;
    if (data.favoriteDrink) u.favoriteDrink = data.favoriteDrink;
    memStore.users.set(userId, u);
    return {
      id: u.id,
      nickname: u.nickname,
      teamId: u.teamId,
      avatar: u.avatar,
      title: u.title,
      bio: u.bio,
      favoriteDrink: u.favoriteDrink,
      teamRole: u.teamRole
    };
  }
  throw new Error('Nie znaleziono użytkownika');
}

// --- EKIPY (TEAMS) ---
export async function createTeam(
  userId: string,
  name: string,
  region: string,
  badge = '⚡',
  color = 'amber',
  motto = 'Zgrana ekipa nocna'
) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.create({
        data: {
          name,
          region,
          code,
          motto,
          badge,
          color,
          ownerId: userId,
          members: { connect: { id: userId } }
        }
      });
      await prisma.user.update({
        where: { id: userId },
        data: { teamId: team.id, teamRole: 'OWNER' }
      });
      return team;
    } catch {}
  }

  const teamId = 'team_' + Math.random().toString(36).substring(2, 10);
  const newTeam: MemoryTeam = {
    id: teamId,
    name,
    code,
    region,
    motto,
    badge,
    color,
    ownerId: userId,
    createdAt: new Date()
  };
  memStore.teams.set(teamId, newTeam);

  const u = memStore.users.get(userId);
  if (u) {
    u.teamId = teamId;
    u.teamRole = 'OWNER';
    memStore.users.set(userId, u);
  }

  return newTeam;
}

export async function joinTeam(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();

  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.findUnique({ where: { code } });
      if (!team) throw new Error('Nieprawidłowy kod ekipy');
      await prisma.user.update({
        where: { id: userId },
        data: { teamId: team.id, teamRole: 'MEMBER' }
      });
      return team;
    } catch (e: any) {
      if (e.message.includes('Nieprawidłowy')) throw e;
    }
  }

  let foundTeam: MemoryTeam | null = null;
  for (const t of memStore.teams.values()) {
    if (t.code === code) {
      foundTeam = t;
      break;
    }
  }

  if (!foundTeam) throw new Error('Nieprawidłowy kod ekipy');

  const u = memStore.users.get(userId);
  if (u) {
    u.teamId = foundTeam.id;
    u.teamRole = 'MEMBER';
    memStore.users.set(userId, u);
  }

  return foundTeam;
}

export async function leaveTeam(userId: string) {
  if (await isPrismaAvailable()) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { team: true } });
      if (user?.team) {
        // Jeśli jest właścicielem, przenieś własność na innego członka lub usuń ekipę
        if (user.team.ownerId === userId) {
          const otherMembers = await prisma.user.findMany({
            where: { teamId: user.teamId, id: { not: userId } }
          });
          if (otherMembers.length > 0) {
            await prisma.team.update({
              where: { id: user.team.id },
              data: { ownerId: otherMembers[0].id }
            });
            await prisma.user.update({
              where: { id: otherMembers[0].id },
              data: { teamRole: 'OWNER' }
            });
          } else {
            await prisma.team.delete({ where: { id: user.team.id } });
          }
        }
      }
      await prisma.user.update({
        where: { id: userId },
        data: { teamId: null, teamRole: 'MEMBER' }
      });
      return;
    } catch {}
  }

  const u = memStore.users.get(userId);
  if (u && u.teamId) {
    const t = memStore.teams.get(u.teamId);
    if (t && t.ownerId === userId) {
      const otherMembers: MemoryUser[] = Array.from(memStore.users.values()).filter((m: MemoryUser) => m.teamId === t.id && m.id !== userId);
      if (otherMembers.length > 0) {
        t.ownerId = otherMembers[0].id;
        otherMembers[0].teamRole = 'OWNER';
        memStore.teams.set(t.id, t);
        memStore.users.set(otherMembers[0].id, otherMembers[0]);
      } else {
        memStore.teams.delete(t.id);
      }
    }
    u.teamId = null;
    u.teamRole = 'MEMBER';
    memStore.users.set(userId, u);
  }
}

export async function updateTeamDetails(
  teamId: string,
  requesterId: string,
  data: { name?: string; motto?: string; badge?: string; color?: string }
) {
  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      const requester = await prisma.user.findUnique({ where: { id: requesterId } });
      if (team?.ownerId !== requesterId && requester?.teamRole !== 'OFFICER') {
        throw new Error('Brak uprawnień do edycji ekipy');
      }
      await prisma.team.update({
        where: { id: teamId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.motto ? { motto: data.motto } : {}),
          ...(data.badge ? { badge: data.badge } : {}),
          ...(data.color ? { color: data.color } : {})
        }
      });
      return;
    } catch (e: any) {
      if (e.message.includes('Brak uprawnień')) throw e;
    }
  }

  const t = memStore.teams.get(teamId);
  const req = memStore.users.get(requesterId);
  if (!t) throw new Error('Nie znaleziono ekipy');
  if (t.ownerId !== requesterId && req?.teamRole !== 'OFFICER') {
    throw new Error('Brak uprawnień do edycji ekipy');
  }

  if (data.name) t.name = data.name;
  if (data.motto) t.motto = data.motto;
  if (data.badge) t.badge = data.badge;
  if (data.color) t.color = data.color;
  memStore.teams.set(teamId, t);
}

export async function setMemberRole(
  teamId: string,
  requesterId: string,
  memberId: string,
  newRole: 'OFFICER' | 'MEMBER'
) {
  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (team?.ownerId !== requesterId) throw new Error('Tylko Lider może zarządzać rangami');
      await prisma.user.update({ where: { id: memberId }, data: { teamRole: newRole } });
      return;
    } catch (e: any) {
      if (e.message.includes('Tylko Lider')) throw e;
    }
  }

  const t = memStore.teams.get(teamId);
  if (t?.ownerId !== requesterId) throw new Error('Tylko Lider może zarządzać rangami');
  const m = memStore.users.get(memberId);
  if (m && m.teamId === teamId) {
    m.teamRole = newRole;
    memStore.users.set(memberId, m);
  }
}

export async function kickMember(teamId: string, requesterId: string, memberId: string) {
  if (requesterId === memberId) throw new Error('Nie możesz wyrzucić samego siebie');

  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      const requester = await prisma.user.findUnique({ where: { id: requesterId } });
      const target = await prisma.user.findUnique({ where: { id: memberId } });

      const isLeader = team?.ownerId === requesterId;
      const isOfficer = requester?.teamRole === 'OFFICER';

      if (!isLeader && (!isOfficer || target?.teamRole === 'OFFICER' || target?.teamRole === 'OWNER')) {
        throw new Error('Brak uprawnień do usunięcia członka');
      }

      await prisma.user.update({
        where: { id: memberId },
        data: { teamId: null, teamRole: 'MEMBER' }
      });
      return;
    } catch (e: any) {
      if (e.message.includes('Brak uprawnień')) throw e;
    }
  }

  const t = memStore.teams.get(teamId);
  const req = memStore.users.get(requesterId);
  const tgt = memStore.users.get(memberId);

  const isLeader = t?.ownerId === requesterId;
  const isOfficer = req?.teamRole === 'OFFICER';

  if (!isLeader && (!isOfficer || tgt?.teamRole === 'OFFICER' || tgt?.teamRole === 'OWNER')) {
    throw new Error('Brak uprawnień do usunięcia członka');
  }

  if (tgt) {
    tgt.teamId = null;
    tgt.teamRole = 'MEMBER';
    memStore.users.set(memberId, tgt);
  }
}

export async function getTeamDetails(teamId: string): Promise<TeamDetails | null> {
  if (await isPrismaAvailable()) {
    try {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: { visits: true }
          }
        }
      });
      if (team) {
        const uniqueTeamBars = new Set<string>();
        const members: TeamMemberItem[] = team.members.map((m: any) => {
          m.visits.forEach((v: any) => uniqueTeamBars.add(v.osmId));
          return {
            id: m.id,
            nickname: m.nickname,
            avatar: m.avatar || '🍺',
            title: m.title || 'Nowicjusz',
            teamRole: m.id === team.ownerId ? 'OWNER' : (m.teamRole || 'MEMBER'),
            visitsCount: m.visits.length
          };
        });

        // Posortuj członków: Właściciel, potem Oficerowie, potem wg wizyt
        members.sort((a, b) => {
          if (a.teamRole === 'OWNER') return -1;
          if (b.teamRole === 'OWNER') return 1;
          if (a.teamRole === 'OFFICER' && b.teamRole !== 'OFFICER') return -1;
          if (b.teamRole === 'OFFICER' && a.teamRole !== 'OFFICER') return 1;
          return b.visitsCount - a.visitsCount;
        });

        const score = uniqueTeamBars.size;
        return {
          id: team.id,
          name: team.name,
          code: team.code,
          region: team.region,
          motto: team.motto || 'Zgrana ekipa nocna',
          badge: team.badge || '⚡',
          color: team.color || 'amber',
          ownerId: team.ownerId,
          members,
          totalScore: score,
          level: calculateTeamLevel(score)
        };
      }
    } catch {}
  }

  // Fallback in-memory
  const t = memStore.teams.get(teamId);
  if (!t) return null;

  const teamMembers: MemoryUser[] = Array.from(memStore.users.values()).filter((u: MemoryUser) => u.teamId === teamId);
  const uniqueTeamBars = new Set<string>();

  const members: TeamMemberItem[] = teamMembers.map((m: MemoryUser) => {
    const visits = memStore.visits.filter((v: MemoryVisit) => v.userId === m.id);
    visits.forEach((v: MemoryVisit) => uniqueTeamBars.add(v.osmId));
    return {
      id: m.id,
      nickname: m.nickname,
      avatar: m.avatar,
      title: m.title,
      teamRole: m.id === t.ownerId ? 'OWNER' : m.teamRole,
      visitsCount: visits.length
    };
  });

  members.sort((a, b) => {
    if (a.teamRole === 'OWNER') return -1;
    if (b.teamRole === 'OWNER') return 1;
    if (a.teamRole === 'OFFICER' && b.teamRole !== 'OFFICER') return -1;
    if (b.teamRole === 'OFFICER' && a.teamRole !== 'OFFICER') return 1;
    return b.visitsCount - a.visitsCount;
  });

  const score = uniqueTeamBars.size;
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    region: t.region,
    motto: t.motto,
    badge: t.badge,
    color: t.color,
    ownerId: t.ownerId,
    members,
    totalScore: score,
    level: calculateTeamLevel(score)
  };
}

// --- WIZYTY W BARACH ---
export async function toggleVisit(userId: string, osmId: string, barName: string) {
  if (await isPrismaAvailable()) {
    try {
      const existing = await prisma.barVisit.findUnique({
        where: { userId_osmId: { userId, osmId } }
      });
      if (existing) {
        await prisma.barVisit.delete({ where: { id: existing.id } });
        return false;
      } else {
        await prisma.barVisit.create({ data: { userId, osmId, barName } });
        return true;
      }
    } catch {}
  }

  const idx = memStore.visits.findIndex((v: any) => v.userId === userId && v.osmId === osmId);
  if (idx !== -1) {
    memStore.visits.splice(idx, 1);
    return false;
  } else {
    memStore.visits.push({
      id: 'vis_' + Math.random().toString(36).substring(2, 9),
      userId,
      osmId,
      barName,
      visitedAt: new Date()
    });
    return true;
  }
}

export async function getTeamVisits(teamId: string): Promise<string[]> {
  if (!teamId) return [];

  if (await isPrismaAvailable()) {
    try {
      const users = await prisma.user.findMany({
        where: { teamId },
        include: { visits: true }
      });
      const teamVisits = new Set<string>();
      users.forEach((u: any) => u.visits.forEach((v: any) => teamVisits.add(v.osmId)));
      return Array.from(teamVisits);
    } catch {}
  }

  const teamMembers: MemoryUser[] = Array.from(memStore.users.values()).filter((u: MemoryUser) => u.teamId === teamId);
  const memberIds = new Set<string>(teamMembers.map((m: MemoryUser) => m.id));
  const visits = memStore.visits.filter((v: MemoryVisit) => memberIds.has(v.userId));
  const set = new Set<string>(visits.map((v: MemoryVisit) => v.osmId));
  return Array.from(set);
}

export async function getUserVisits(userId: string): Promise<string[]> {
  if (!userId) return [];

  if (await isPrismaAvailable()) {
    try {
      const visits = await prisma.barVisit.findMany({
        where: { userId },
        select: { osmId: true }
      });
      return visits.map((v: any) => v.osmId);
    } catch {}
  }

  return memStore.visits.filter((v: MemoryVisit) => v.userId === userId).map((v: MemoryVisit) => v.osmId);
}

// --- RANKINGI I LEADERBOARD ---
export async function getLeaderboard(region: string) {
  if (await isPrismaAvailable()) {
    try {
      const teams = await prisma.team.findMany({
        where: { region },
        include: {
          members: {
            include: { visits: true }
          }
        }
      });

      const leaderboard = teams.map((team: any) => {
        const uniqueBars = new Set<string>();
        team.members.forEach((member: any) => {
          member.visits.forEach((visit: any) => uniqueBars.add(visit.osmId));
        });
        const score = uniqueBars.size;
        return {
          id: team.id,
          name: team.name,
          badge: team.badge || '⚡',
          color: team.color || 'amber',
          motto: team.motto || 'Zgrana ekipa nocna',
          score,
          level: calculateTeamLevel(score),
          memberCount: team.members.length
        };
      });

      return leaderboard.sort((a, b) => b.score - a.score);
    } catch {}
  }

  const teams: MemoryTeam[] = Array.from(memStore.teams.values()).filter((t: MemoryTeam) => t.region === region || region === 'Wszystkie');
  const leaderboard = teams.map((t: MemoryTeam) => {
    const members: MemoryUser[] = Array.from(memStore.users.values()).filter((u: MemoryUser) => u.teamId === t.id);
    const memberIds = new Set<string>(members.map((m: MemoryUser) => m.id));
    const visits = memStore.visits.filter((v: MemoryVisit) => memberIds.has(v.userId));
    const uniqueBars = new Set<string>(visits.map((v: MemoryVisit) => v.osmId));
    const score = uniqueBars.size;
    return {
      id: t.id,
      name: t.name,
      badge: t.badge,
      color: t.color,
      motto: t.motto,
      score,
      level: calculateTeamLevel(score),
      memberCount: members.length
    };
  });

  return leaderboard.sort((a, b) => b.score - a.score);
}
