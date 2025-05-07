// src/hooks/useUndoRedo.js
import { useState, useCallback } from 'react';

const MAX_HISTORY_SIZE = 50; // Max number of states to keep in history

export const useUndoRedo = (initialPresent) => {
    const [history, setHistory] = useState({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;

    const setPresentState = useCallback((newPresent) => {
        setHistory(h => {
            const newPast = [...h.past, h.present];
            // Limit history size
            if (newPast.length > MAX_HISTORY_SIZE) {
                newPast.shift(); // Remove the oldest state
            }
            return {
                past: newPast,
                present: newPresent,
                future: [], // Clear future on new action
            };
        });
    }, []);

    const undo = useCallback(() => {
        if (!canUndo) return;
        setHistory(h => {
            const newFuture = [h.present, ...h.future];
            const newPresent = h.past[h.past.length - 1];
            const newPast = h.past.slice(0, h.past.length - 1);
            return {
                past: newPast,
                present: newPresent,
                future: newFuture,
            };
        });
    }, [canUndo]);

    const redo = useCallback(() => {
        if (!canRedo) return;
        setHistory(h => {
            const newPast = [...h.past, h.present];
            const newPresent = h.future[0];
            const newFuture = h.future.slice(1);
            return {
                past: newPast,
                present: newPresent,
                future: newFuture,
            };
        });
    }, [canRedo]);

    // This function is used when you load data (e.g., from localStorage or import)
    // to reset the history with a new present state.
    const resetHistory = useCallback((newInitialPresent) => {
        setHistory({
            past: [],
            present: newInitialPresent,
            future: [],
        });
    }, []);


    return {
        state: history.present,
        setState: setPresentState, // Renamed for clarity when using the hook
        resetState: resetHistory, // For initializing or resetting the state entirely
        undo,
        redo,
        canUndo,
        canRedo,
        // Expose past and future if needed for debugging or more complex scenarios
        // pastStates: history.past,
        // futureStates: history.future,
    };
};