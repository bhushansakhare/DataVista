import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let sharedSocket = null;
function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  }
  return sharedSocket;
}

export function useSocket(handlers = {}, deps = []) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = getSocket();
    const wrapped = {};
    for (const evt of Object.keys(handlersRef.current)) {
      wrapped[evt] = (...args) => handlersRef.current[evt]?.(...args);
      socket.on(evt, wrapped[evt]);
    }
    return () => {
      for (const evt of Object.keys(wrapped)) socket.off(evt, wrapped[evt]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return getSocket();
}

export function getGlobalSocket() {
  return getSocket();
}
