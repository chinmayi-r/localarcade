/**
 * M9 ships dark. No production surface may render battles while this is false;
 * the boundary test additionally asserts that nothing under app/ imports this
 * module at all. Turning battles on is a product decision recorded in
 * DECISIONS.md, not a code change slipped into a feature PR.
 */
export const battlesEnabled = false as const;
