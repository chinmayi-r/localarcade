import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationList } from "../app/components/finder/recommendation-list";

test("A5Y: zero recommendation data renders the designed honest empty state", () => {
  const html = renderToStaticMarkup(<RecommendationList recommendations={[]} selectedId={null} onSelect={() => undefined} />);
  assert.match(html, /NO SAFE MATCHES/);
  assert.match(html, /Nothing in the prototype catalog fits these constraints/);
  assert.match(html, /will not be padded/);
  assert.doesNotMatch(html, /undefined|null|placeholder/i);
});
