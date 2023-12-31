import { ActionInfo, Manifest, Package, SCM } from "./types";

import fs from "fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  PullRequestEvent,
  PushEvent,
  WorkflowDispatchEvent,
} from "@octokit/webhooks-definitions/schema";

const getBool = (input: string): boolean => (input === "on" ? true : false);

const getPackageInfo = (): Package => {
  const packageJsonLocation = `${process.env.GITHUB_WORKSPACE}/package.json`;
  const packageJson = require(packageJsonLocation);
  const { name, version } = packageJson;
  return { name, version };
};

const getActionInfo = (): { ghAction: ActionInfo } => {
  const workflow = process.env.GITHUB_WORKFLOW;
  const runnerArch = process.env.RUNNER_ARCH;
  const runnerName = process.env.RUNNER_NAME;
  const runnerOs = process.env.RUNNER_OS;

  const ghAction = {
    workflow,
    runner: {
      arch: runnerArch,
      name: runnerName,
      os: runnerOs,
    },
  };

  return { ghAction };
};

const getScm = (): { scm: SCM | null } => {
  const { context } = github;
  const events = ["push", "pull_request", "workflow_dispatch"];

  if (!events.includes(context.eventName)) {
    return { scm: null };
  }

  const { repository } = github.context.payload as
    | PushEvent
    | WorkflowDispatchEvent
    | PullRequestEvent;
  const { sha, ref } = context;
  const { ssh_url, clone_url } = repository;

  const branch = process.env.GITHUB_REF_NAME;

  const scm = {
    eventName: context.eventName,
    ssh_url,
    clone_url,
    branch,
    sha,
    ref,
  };

  return { scm };
};

const writeDockerFile = (manifestName: string) => {
  const dockerCommand = `\nCOPY ${manifestName} ./\n`;
  const dockerFile = `${process.env.GITHUB_WORKSPACE}/Dockerfile`;
  core.debug(
    `Appending command to docker file (${dockerFile}): ${dockerCommand}`,
  );
  fs.appendFileSync(dockerFile, dockerCommand);
};

try {
  if (!process.env.GITHUB_WORKSPACE)
    throw new Error("Please checkout your repository first (see README)");

  const writeScm = core.getBooleanInput("scm-info");
  const writePackageInfo = core.getBooleanInput("package-info");
  const writeActionInfo = core.getBooleanInput("action-info");
  const appendDockerFile = core.getBooleanInput("append-dockerfile");
  const manifestFile = core.getInput("manifest-file");

  core.debug(
    `Manifest ${manifestFile} being generated with SCM: ${writeScm}, package.json info: ${writePackageInfo}, action info: ${writeActionInfo}`,
  );

  const timestamp = new Date().toISOString();

  const manifest: Manifest = {
    timestamp,
    ...(writeScm && getScm()),
    ...(writePackageInfo && getPackageInfo()),
    ...(writeActionInfo && getActionInfo()),
  };

  fs.writeFileSync(
    manifestFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf-8",
  );

  if (appendDockerFile) {
    writeDockerFile(manifestFile);
  }

  appendDockerFile
    ? core.info(
        `📝 Manifest: ${manifestFile} + COPY to Dockerfile sadfaskfkdsfadsfasdfsda`,
      )
    : core.info(`📝 Manifest: ${manifestFile} asdfsdafsdfsafdafdfdas`);
} catch (e) {
  core.error(e as Error);
  core.setFailed((e as Error).message);
}
