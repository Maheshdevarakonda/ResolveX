import bcrypt from "bcrypt";
import { isTest } from "../config/env";

// Higher = slower to brute-force. Tests use a low value so they run fast.
export const BCRYPT_ROUNDS = isTest ? 4 : 12;

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_ROUNDS);
