import {
  RESEARCH_TOKEN_SECRET,
  RESEND_API_KEY,
  TURNSTILE_SECRET_KEY,
} from "astro:env/server";
import { RESEARCH } from "@/research.config";
import { createResendClient } from "@/utils/research/resend";
import type { SignupArticle, SignupConfig } from "@/utils/research/signup";
import { getResearchArticles } from "@/utils/researchCollections";

export const signupConfig = (): SignupConfig => ({
  resendApiKey: RESEND_API_KEY,
  tokenSecret: RESEARCH_TOKEN_SECRET,
  turnstileSecret: TURNSTILE_SECRET_KEY,
  segmentId: RESEARCH.segmentId,
  allTopicId: RESEARCH.allTopicId,
  blogTopicId: RESEARCH.blogTopicId,
  from: RESEARCH.from,
  siteUrl: RESEARCH.siteUrl,
  consentTextVersion: RESEARCH.consentTextVersion,
});

export const signupArticles = async (): Promise<SignupArticle[]> =>
  (await getResearchArticles()).map(({ slug, title }) => ({ slug, title }));

export const signupResendClient = () =>
  createResendClient(RESEND_API_KEY ?? "");

export const nowSeconds = () => Math.floor(Date.now() / 1000);
