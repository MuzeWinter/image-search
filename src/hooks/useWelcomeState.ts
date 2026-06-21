import { useState, useEffect } from "react";

const STORAGE_KEY = "zoobet_welcome_done";

export function useWelcomeState(): [boolean, () => void] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => setShow(false);

  return [show, dismiss];
}
