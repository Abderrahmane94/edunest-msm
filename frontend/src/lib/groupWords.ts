import type { TFunction } from 'i18next';

/**
 * A group's own words. Kiddoo's pages say "group" and "nurseries"; a client
 * sees the words chosen for it (an association and its clubs, a network and
 * its establishments…), in French and in Arabic, each sentence keeping its
 * grammar: the pieces it needs come from groupTerms / memberTerms.
 */

export const GROUP_TERMS = ['group', 'association', 'network', 'federation'] as const;
export const MEMBER_TERMS = ['nursery', 'club', 'establishment', 'daycare'] as const;
export type GroupTerm = (typeof GROUP_TERMS)[number];
export type MemberTerm = (typeof MEMBER_TERMS)[number];

const asGroup = (term?: string | null): GroupTerm => (GROUP_TERMS as readonly string[]).includes(term ?? '') ? (term as GroupTerm) : 'group';
const asMember = (term?: string | null): MemberTerm => (MEMBER_TERMS as readonly string[]).includes(term ?? '') ? (term as MemberTerm) : 'nursery';

/** The pieces a sentence may use, as interpolation values. `count` picks the singular or the plural for {{members}}. */
export function groupWords(t: TFunction, groupTerm?: string | null, memberTerm?: string | null, count?: number): Record<string, string> {
  const g = (piece: string) => t(`groupTerms.${asGroup(groupTerm)}.${piece}`);
  const m = (piece: string) => t(`memberTerms.${asMember(memberTerm)}.${piece}`);
  return {
    group: g('label'),
    groupYour: g('your'),
    groupAll: g('all'),
    groupOf: g('of'),
    member: m('label'),
    memberOne: m('one'),
    memberOther: m('other'),
    members: count === 1 ? m('one') : m('other'),
    membersYour: m('your'),
    memberThisBelongs: m('thisBelongs'),
    memberPer: m('per'),
  };
}
