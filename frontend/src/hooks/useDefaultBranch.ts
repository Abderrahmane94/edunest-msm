import { useBranches } from '@/hooks/useBranchBillingConfig';

/**
 * Returns the default (and only) branch for the current school.
 * 
 * This hook abstracts away the branch concept from the UI.
 * In the current architecture, each school has exactly one auto-created branch.
 * The user never sees or selects a branch — it's resolved automatically.
 */
export function useDefaultBranch() {
  const { data: branches, isLoading } = useBranches();
  const branch = branches?.[0] ?? null;

  return {
    branchId: branch?.id ?? '',
    branchName: branch?.name ?? '',
    isLoading,
    branch,
  };
}
