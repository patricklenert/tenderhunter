import assert from "node:assert/strict";
import HomePage from "../app/page";
import { HomeSeoContent } from "../components/seo/HomeSeoContent";
import { InteractiveApp } from "../components/seo/InteractiveApp";

const page = HomePage();
interface PageChild {
  type?: unknown;
}

const children = (Array.isArray(page.props.children) ? page.props.children : [page.props.children]) as PageChild[];
const interactiveIndex = children.findIndex((child) => child?.type === InteractiveApp);
const seoIndex = children.findIndex((child) => child?.type === HomeSeoContent);

assert.notEqual(interactiveIndex, -1, "homepage must render the interactive shell");
assert.equal(seoIndex, interactiveIndex + 1, "homepage SEO content must follow the complete interactive shell");

console.log("Homepage SEO layout regression test passed.");
