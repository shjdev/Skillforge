import { describe, it, expect } from 'vitest';
import { canRead, canWrite, resolveNewOwnerId } from './ownership';

const admin = { userId: 'default-user', isAdmin: true };
const lucas = { userId: 'user-lucas', isAdmin: false };

describe('canRead', () => {
  it('lets anyone read the shared catalog', () => {
    expect(canRead(lucas, null)).toBe(true);
    expect(canRead(lucas, undefined)).toBe(true);
  });

  it('lets a tester read their own resources only', () => {
    expect(canRead(lucas, 'user-lucas')).toBe(true);
    expect(canRead(lucas, 'user-emma')).toBe(false);
  });

  it('lets the admin read everything', () => {
    expect(canRead(admin, 'user-emma')).toBe(true);
  });
});

describe('canWrite', () => {
  it('forbids a tester from changing the shared catalog', () => {
    expect(canWrite(lucas, null)).toBe(false);
    expect(canWrite(lucas, undefined)).toBe(false);
  });

  it("forbids a tester from changing another tester's resource", () => {
    expect(canWrite(lucas, 'user-emma')).toBe(false);
  });

  it('lets a tester change their own resource', () => {
    expect(canWrite(lucas, 'user-lucas')).toBe(true);
  });

  it('lets the admin change everything', () => {
    expect(canWrite(admin, null)).toBe(true);
    expect(canWrite(admin, 'user-emma')).toBe(true);
  });
});

describe('resolveNewOwnerId', () => {
  it('always makes a tester creation personal, even without the personal flag', () => {
    expect(resolveNewOwnerId(lucas, false)).toBe('user-lucas');
    expect(resolveNewOwnerId(lucas, true)).toBe('user-lucas');
  });

  it('lets the admin choose between shared catalog and personal', () => {
    expect(resolveNewOwnerId(admin, false)).toBeNull();
    expect(resolveNewOwnerId(admin, true)).toBe('default-user');
  });
});
