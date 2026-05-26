import { useEffect, useRef } from "react";
import { commsClient } from "./comms";

export function useComms(topic: string, handler: (data: unknown) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    commsClient.connect();
    const unsubscribe = commsClient.on(topic, (data) => {
      handlerRef.current(data);
    });
    return unsubscribe;
  }, [topic]);
}
