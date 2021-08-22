import { Colors, ensureDir, ensureFile, existsSync } from "../deps.ts";
import {
  DEFAULT_DATAFILES_PATH,
  DEFAULT_DIM_FILE_PATH,
  DEFAULT_DIM_LOCK_FILE_PATH,
  DIM_LOCK_VERSION,
} from "./consts.ts";
import { Downloader } from "./downloader.ts";
import { DimFileAccessor, DimLockFileAccessor } from "./accessor.ts";
import { Content, DimJSON, DimLockJSON, LockContent } from "./types.ts";

const initDimFile = async () => {
  const dimData: DimJSON = { contents: [] };
  await ensureFile(DEFAULT_DIM_FILE_PATH);
  return await Deno.writeTextFile(
    DEFAULT_DIM_FILE_PATH,
    JSON.stringify(dimData, null, 2),
  );
};

const initDimLockFile = async () => {
  const dimLockData: DimLockJSON = {
    lockFileVersion: DIM_LOCK_VERSION,
    contents: [],
  };
  await ensureFile(DEFAULT_DIM_LOCK_FILE_PATH);
  return await Deno.writeTextFile(
    DEFAULT_DIM_LOCK_FILE_PATH,
    JSON.stringify(dimLockData, null, 2),
  );
};

const createDataFilesDir = async () => {
  await ensureDir(DEFAULT_DATAFILES_PATH);
};

const installFromURL = async (url: string, isUpdate = false) => {
  const dimLockFileAccessor = new DimLockFileAccessor();
  const isInstalled = dimLockFileAccessor.getContents().some((
    lockContent,
  ) => lockContent.url === url);
  if (isInstalled && !isUpdate) {
    console.log("The url have already been installed.");
    Deno.exit(0);
  }
  return await Promise.all([
    new Downloader().download(new URL(url)),
    new DimFileAccessor().addContent(url, url, []),
  ]);
};

const installFromDimFile = async (isUpdate = false) => {
  let contents = new DimFileAccessor().getContents();
  if (contents.length == 0) {
    console.log("No contents.\nYou should run a 'dim install <data url>'. ");
    return;
  }
  const dimLockFileAccessor = new DimLockFileAccessor();
  if (!isUpdate) {
    const isNotInstalled = (content: Content) =>
      dimLockFileAccessor.getContents().every((lockContent) =>
        lockContent.url !== content.url
      );
    contents = contents.filter(isNotInstalled);
  }
  const downloadList = contents.map((content) => {
    return new Promise<LockContent>((resolve) => {
      new Downloader().download(new URL(content.url)).then((result) => {
        console.log(
          Colors.green(`Installed ${content.url}`),
          `\nFile path:`,
          Colors.yellow(result.fullPath),
        );
        console.log();
        resolve({
          url: content.url,
          path: result.fullPath,
          name: content.name,
          preprocesses: [],
          lastUpdated: new Date(),
        });
      });
    });
  });
  return await Promise.all(downloadList);
};

export class InitAction {
  async execute(options: any) {
    await Promise.all([
      createDataFilesDir,
      initDimFile,
      initDimLockFile,
    ]);
    console.log(Colors.green("Initialized the project for the dim."));
  }
}

export class InstallAction {
  async execute(options: any, url: string | undefined) {
    await createDataFilesDir();
    if (!existsSync(DEFAULT_DIM_LOCK_FILE_PATH)) {
      await initDimLockFile();
    }

    if (url !== undefined) {
      const results = await installFromURL(url).catch((error) => {
        console.error(
          Colors.red("Failed to install."),
          Colors.red(error.message),
        );
        Deno.exit(0);
      });
      if (results !== undefined) {
        const fullPath = results[0].fullPath;
        const lockContent: LockContent = {
          url: url,
          path: fullPath,
          name: url,
          preprocesses: [],
          lastUpdated: new Date(),
        };
        await new DimLockFileAccessor().addContent(lockContent);
        console.log(
          Colors.green(`Installed ${url}.`),
          `\nFile path:`,
          Colors.yellow(fullPath),
        );
      }
    } else {
      const lockContentList = await installFromDimFile().catch((error) => {
        console.error(
          Colors.red("Failed to install."),
          Colors.red(error.message),
        );
        Deno.exit(0);
      });
      if (lockContentList !== undefined) {
        await new DimLockFileAccessor().addContents(lockContentList);
        if (lockContentList.length != 0) {
          console.log(
            Colors.green(`Successfully installed.`),
          );
        } else {
          console.log("All contents have already been installed.");
        }
      }
    }
  }
}

export class UninstallAction {
  execute(options: any, name: string): void {
    console.log(options, name);
  }
}

export class ListAction {
  execute(options: any): void {
    console.log(options);
  }
}

export class UpdateAction {
  async execute(options: any, url: string | undefined) {
    await createDataFilesDir();
    if (!existsSync(DEFAULT_DIM_LOCK_FILE_PATH)) {
      await initDimLockFile();
    }

    if (url !== undefined) {
      const results = await installFromURL(url, true).catch((error) => {
        console.error(
          Colors.red("Failed to update."),
          Colors.red(error.message),
        );
        Deno.exit(0);
      });
      const fullPath = results[0].fullPath;
      const lockContent: LockContent = {
        url: url,
        path: fullPath,
        name: url,
        preprocesses: [],
        lastUpdated: new Date(),
      };
      await new DimLockFileAccessor().addContent(lockContent);
      console.log(
        Colors.green(`Updated ${url}.`),
        `\nFile path:`,
        Colors.yellow(fullPath),
      );
    } else {
      const lockContentList = await installFromDimFile(true).catch((error) => {
        console.error(
          Colors.red("Failed to update."),
          Colors.red(error.message),
        );
        Deno.exit(0);
      });
      if (lockContentList !== undefined) {
        await new DimLockFileAccessor().addContents(lockContentList);
      }
      console.log(
        Colors.green(`Successfully Updated.`),
      );
    }
  }
}
