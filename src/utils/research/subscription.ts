type TopicSubscription = { id: string; subscription: "opt_in" | "opt_out" };

export interface ContactState {
  exists: boolean;
  unsubscribed: boolean;
  topics: TopicSubscription[];
}

export interface ConfirmPlan {
  create: boolean;
  setUnsubscribedFalse: boolean;
  topics: TopicSubscription[];
  scopes: string[];
}

export function planConfirmation(
  scope: string,
  contact: ContactState,
  ids: {
    allTopicId: string;
    blogTopicId: string;
    articleTopicIds: Record<string, string>;
  },
  existingScopes: string[],
): ConfirmPlan {
  const resetToResearchOnly = !contact.exists || contact.unsubscribed;
  const optIns =
    scope === "all"
      ? [ids.allTopicId, ...Object.values(ids.articleTopicIds)]
      : [ids.articleTopicIds[scope]];
  const wanted: TopicSubscription[] = [
    ...optIns.map((id) => ({ id, subscription: "opt_in" as const })),
    ...(resetToResearchOnly
      ? [{ id: ids.blogTopicId, subscription: "opt_out" as const }]
      : []),
  ];
  const current = new Map(contact.topics.map((t) => [t.id, t.subscription]));
  return {
    create: !contact.exists,
    setUnsubscribedFalse: resetToResearchOnly,
    topics: wanted.filter((t) => current.get(t.id) !== t.subscription),
    scopes: [...new Set([...existingScopes, scope])],
  };
}
