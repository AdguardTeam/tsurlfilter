import React, { useState, useEffect } from 'react';
import { ExtendedMV3MessageType, RecordFiltered } from '@adguard/tswebextension/mv3';

import { sendInnerMessage, sendMessage } from '../../common/send-message';
import { RequestsTable } from '../RequestsTable';
import { Message } from '../../message';

const UPDATE_LOG_INTERVAL_MS = 1000;

export const DebuggingApp = () => {
    const [ruleLog, setRuleLog] = useState<RecordFiltered[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        let isActive = true;
        let timer: number;

        const startAndUpdate = async () => {
            await sendMessage(Message.StartLog);

            const fetchCollected = async () => {
                // To abort mutate state on unmounted component
                if (!isActive) {
                    clearInterval(timer);
                    return;
                }
                try {
                    // eslint-disable-next-line max-len
                    const records = await sendInnerMessage(ExtendedMV3MessageType.GetCollectedLog) as RecordFiltered[];
                    // TODO: drop focus on repaint
                    setRuleLog((items) => items.concat(records));
                } catch (e) {
                    setIsError(true);
                }
            };

            await fetchCollected();
            timer = window.setInterval(fetchCollected, UPDATE_LOG_INTERVAL_MS);
            setIsLoading(false);
        };

        startAndUpdate();

        return () => {
            isActive = false;

            clearInterval(timer);
            // Do not wait for stop
            sendMessage(Message.StopLog);
        };
    }, []);

    const content = isLoading
        ? <h1>Loading source maps...</h1>
        : (
            <RequestsTable
                ruleLog={ruleLog}
                cleanLog={() => setRuleLog([])}
            />
        );

    return (
        <section>
            {
                isError
                    ? 'Open developer tools and reload the page'
                    : content
            }
        </section>
    );
};
