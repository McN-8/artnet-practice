import assert from "node:assert/strict";
import test from "node:test";
import { ArtNetResources } from "../src/artNetResources.js";
import { Chapter } from "../src/chapter.js";
import { Panel } from "../src/panel.js";
import { PanelGroup } from "../src/panelGroup.js";
import { PanelReveal } from "../src/panelReveal.js";
import {
  ProjectValidationError,
  validateProjectDocument
} from "../src/projectValidation.js";
import { State } from "../src/state.js";
import { Story } from "../src/story.js";
import { StorySerializer } from "../src/storySerializer.js";
import { VisualGroup } from "../src/visualGroup.js";
import { createDefaultVisualTreatment } from "../src/visualTransformation.js";

function createProject() {
  const story = new Story("Transforms", "ArtNet");
  const chapter = new Chapter("Chapter");
  const state = new State("ending", "page.png", "An ending page");
  const resources = new ArtNetResources();
  const panel = new Panel("hero", "hero.png", "The hero leaps.");
  const panelGroup = new PanelGroup("scene");
  const treatment = createDefaultVisualTreatment();

  treatment.transform.scaleX = 1.5;
  treatment.transform.flipY = true;
  treatment.appearance.opacity = 0.75;
  treatment.crop = { x: 0.1, y: 0, width: 0.8, height: 1 };
  treatment.mask = { shape: "ellipse", feather: 0.2 };
  treatment.deformation = {
    type: "stretch",
    amountX: 0.25,
    amountY: -0.1
  };

  panelGroup.addReveal(
    new PanelReveal(panel, 0, 10, 20, 300, 400, 5, treatment)
  );
  state.isEnding = true;
  state.addPanelGroup(panelGroup);
  chapter.addState(state);
  story.addChapter(chapter);
  resources.panels.register(panel);
  resources.panelGroups.register(panelGroup);
  resources.visualGroups.register(
    new VisualGroup("characters", [panel.id], treatment)
  );
  return { story, resources, panel, treatment };
}

test("visual treatments round trip without mutating panel resources", () => {
  const { story, resources, panel, treatment } = createProject();
  const loaded = StorySerializer.fromJSON(
    StorySerializer.toJSON(story, resources)
  );
  const reveal = loaded.resources.panelGroups.get("scene")!.reveals[0]!;
  const group = loaded.resources.visualGroups.get("characters")!;

  assert.deepEqual(reveal.treatment, treatment);
  assert.deepEqual(group.treatment, treatment);
  assert.deepEqual(group.panelIds, ["hero"]);
  assert.equal(reveal.panel, loaded.resources.panels.get("hero"));
  assert.equal(panel.asset, "hero.png");

  reveal.treatment.transform.scaleX = 9;
  assert.equal(group.treatment.transform.scaleX, 1.5);
  assert.equal(panel.asset, "hero.png");
});

test("legacy reveals receive an identity visual treatment", () => {
  const { story, resources } = createProject();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));
  delete document.resources.panelGroups[0].reveals[0].treatment;
  delete document.resources.visualGroups;

  const loaded = StorySerializer.fromJSON(JSON.stringify(document));
  assert.deepEqual(
    loaded.resources.panelGroups.get("scene")!.reveals[0]!.treatment,
    createDefaultVisualTreatment()
  );
  assert.deepEqual(loaded.resources.visualGroups.getAll(), []);
});

test("visual validation reports nested ranges, catalogs, and references", () => {
  const { story, resources } = createProject();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));
  const treatment =
    document.resources.panelGroups[0].reveals[0].treatment;

  treatment.transform.scaleX = 0;
  treatment.appearance.opacity = 2;
  treatment.mask.shape = "star";
  treatment.crop.width = -1;
  document.resources.visualGroups[0].panelIds = ["missing"];

  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      const paths = error.issues.map((issue) => issue.path);
      assert.ok(paths.includes(
        "$.resources.panelGroups[0].reveals[0].treatment.transform.scaleX"
      ));
      assert.ok(paths.includes(
        "$.resources.panelGroups[0].reveals[0].treatment.appearance.opacity"
      ));
      assert.ok(paths.includes(
        "$.resources.panelGroups[0].reveals[0].treatment.mask.shape"
      ));
      assert.ok(paths.includes(
        "$.resources.panelGroups[0].reveals[0].treatment.crop.width"
      ));
      return true;
    }
  );

  treatment.transform.scaleX = 1;
  treatment.appearance.opacity = 1;
  treatment.mask.shape = "ellipse";
  treatment.crop.width = 0.8;

  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.ok(error.issues.some((issue) =>
        issue.path === "$.resources.visualGroups[0].panelIds[0]"
      ));
      return true;
    }
  );
});

test("a panel cannot belong to multiple visual groups", () => {
  const { story, resources } = createProject();
  const document = JSON.parse(StorySerializer.toJSON(story, resources));

  document.resources.visualGroups.push({
    id: "duplicate-membership",
    panelIds: ["hero"],
    treatment: createDefaultVisualTreatment()
  });

  assert.throws(
    () => validateProjectDocument(document),
    (error: unknown) => {
      assert.ok(error instanceof ProjectValidationError);
      assert.ok(error.issues.some((issue) =>
        issue.path === "$.resources.visualGroups[1].panelIds[0]" &&
        issue.message === 'duplicates grouped panel "hero"'
      ));
      return true;
    }
  );
});
