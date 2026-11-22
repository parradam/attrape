import type { ComponentType } from "react";
import type { List, ViewName } from "../../api/tasks";
import {
  CompletedIcon,
  DroppedIcon,
  InboxIcon,
  NextIcon,
  SomedayIcon,
  WaitingIcon,
} from "../../components/icons";

export type View = {
  id: ViewName;
  title: string;
  path: string;
  // key acts on the selected task: it moves an open task to the view's list,
  // or completes or drops it. In 001c, g plus the same key goes to the view.
  key: string;
  icon: ComponentType<{ className?: string }>;
  // list is set for the four views of open tasks.
  list?: List;
  emptyText: string;
};

// views lists every view, in sidebar order.
export const views: View[] = [
  {
    id: "inbox",
    title: "Inbox",
    path: "/inbox",
    key: "i",
    icon: InboxIcon,
    list: "inbox",
    emptyText: "Nothing in your Inbox.",
  },
  {
    id: "next",
    title: "Next Actions",
    path: "/next",
    key: "n",
    icon: NextIcon,
    list: "next",
    emptyText: "Nothing in Next Actions.",
  },
  {
    id: "waiting",
    title: "Waiting",
    path: "/waiting",
    key: "w",
    icon: WaitingIcon,
    list: "waiting",
    emptyText: "Nothing in Waiting.",
  },
  {
    id: "someday",
    title: "Someday",
    path: "/someday",
    key: "s",
    icon: SomedayIcon,
    list: "someday",
    emptyText: "Nothing in Someday.",
  },
  {
    id: "completed",
    title: "Completed",
    path: "/completed",
    key: "c",
    icon: CompletedIcon,
    emptyText: "Nothing completed yet.",
  },
  {
    id: "dropped",
    title: "Dropped",
    path: "/dropped",
    key: "d",
    icon: DroppedIcon,
    emptyText: "Nothing dropped.",
  },
];

export const viewById = Object.fromEntries(views.map((v) => [v.id, v])) as Record<ViewName, View>;

// viewForPath returns the view at path, or undefined if there isn't one.
export function viewForPath(path: string): View | undefined {
  return views.find((v) => v.path === path);
}
