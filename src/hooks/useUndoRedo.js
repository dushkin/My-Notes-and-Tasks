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

    const setPresentState = useCallback((newState) => {
        setHistory(h => {
            // Check if the newState is a function (like a functional update)
            const finalNewState = typeof newState === 'function' 
                ? newState(h.present) // If so, execute it with the current state
                : newState;             // Otherwise, use the value directly

            // Optimization: Don't create a new history entry if the state hasn't changed
            if (finalNewState === h.present) {
                return h;
            }

            const newPast = [...h.past, h.present];
            // Limit history size
            if (newPast.length > MAX_HISTORY_SIZE) {
                newPast.shift(); // Remove the oldest state
            }
            return {
                past: newPast,
                present: finalNewState, // Use the correctly computed new state
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

    // Update present state without creating undo entry (useful for server sync)
    const updatePresentOnly = useCallback((newPresent) => {
        setHistory(h => ({
            ...h,
            present: typeof newPresent === 'function' ? newPresent(h.present) : newPresent
        }));
    }, []);


    return {
        state: history.present,
        setState: setPresentState, // Renamed for clarity when using the hook
        resetState: resetHistory, // For initializing or resetting the state entirely
        updatePresentOnly, // Update present without creating undo entry
        undo,
        redo,
        canUndo,
        canRedo,
        // Expose past and future if needed for debugging or more complex scenarios
        // pastStates: history.past,
        // futureStates: history.future,
    };
};