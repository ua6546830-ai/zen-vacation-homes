import * as React from "react";

type NavigateOptions = { replace?: boolean; scroll?: boolean };

type RouterValue = {
  path: string;
  search: URLSearchParams;
  navigate: (to: string, options?: NavigateOptions) => void;
};

const RouterContext = React.createContext<RouterValue | null>(null);

const readLocation = () => ({ path: window.location.pathname, search: window.location.search });

function scrollAfterNavigation(hash: string) {
  requestAnimationFrame(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo({ top: 0, left: 0 });
    }
  });
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = React.useState(readLocation);

  React.useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = React.useCallback((to: string, options: NavigateOptions = {}) => {
    const url = new URL(to, window.location.href);
    if (url.origin !== window.location.origin) {
      window.location.assign(url.href);
      return;
    }
    const next = url.pathname + url.search + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next !== current) {
      window.history[options.replace ? "replaceState" : "pushState"](null, "", next);
    }
    setLocation(readLocation());
    if (options.scroll !== false) scrollAfterNavigation(url.hash);
  }, []);

  const value = React.useMemo(
    () => ({ path: location.path, search: new URLSearchParams(location.search), navigate }),
    [location, navigate],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const value = React.useContext(RouterContext);
  if (!value) throw new Error("useRouter must be used inside <RouterProvider>");
  return value;
}

type LinkProps = Omit<React.ComponentProps<"a">, "href"> & {
  to: string;
  replace?: boolean;
  scroll?: boolean;
};

export function Link({ to, replace, scroll, onClick, target, ...props }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (target && target !== "_self")
        ) {
          return;
        }
        event.preventDefault();
        navigate(to, { replace, scroll });
      }}
      {...props}
    />
  );
}

export function useDocumentTitle(title: string) {
  React.useEffect(() => {
    document.title = title;
  }, [title]);
}
