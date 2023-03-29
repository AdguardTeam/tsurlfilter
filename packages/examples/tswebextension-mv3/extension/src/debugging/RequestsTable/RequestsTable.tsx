import React from 'react';
import { RecordFiltered } from '@adguard/tswebextension/mv3';

import './requests-table.css';

type RequestsTableProps = {
    ruleLog: RecordFiltered[],
    cleanLog: () => void,
};

export const RequestsTable = ({
    ruleLog,
    cleanLog,
}: RequestsTableProps) => {
    const titles = [
        'Rule ID',
        'Ruleset ID',
        'Frame ID',
        'Initiator',
        'Method',
        'Request ID',
        'Tab ID',
        'Type',
        'URL',
        'Original rule',
        'JSON Rule',
    ];

    const getActionsBlock = () => {
        return (
            <div className="header">
                {ruleLog.length > 0 ? (
                    <button
                        type="button"
                        onClick={cleanLog}
                    >
                        Clean
                    </button>
                ) : (
                    <div className="title">
                        Open developer tools and reload the page
                    </div>
                )}
            </div>
        );
    };

    const getTableHeader = (titlesArr: string[]) => {
        return (
            <div className="rowHead row">
                {titlesArr.map((title) => (
                    <div key={title} className="cell">
                        {title}
                    </div>
                ))}
            </div>
        );
    };

    const getTableBodyLine = (record: RecordFiltered) => {
        const {
            ruleId,
            rulesetId,
            frameId,
            initiator,
            method,
            requestId,
            tabId,
            type,
            url,
            sourceRules,
            declarativeRuleJson,
        } = record;

        const sourceRulesTxt = sourceRules.map(({ sourceRule, filterId }) => {
            return <p> Rule "{sourceRule}" from filter with id "{filterId}"</p>;
        });

        const formattedJson = declarativeRuleJson
            ? JSON.stringify(JSON.parse(declarativeRuleJson), null, '\t')
            : '';

        return (
            <div className="row" key={`${rulesetId}_${ruleId}_${requestId}_${url}`}>
                <div className="cell">{ruleId}</div>
                <div className="cell">{rulesetId}</div>
                <div className="cell">{frameId}</div>
                <div className="cell">{initiator}</div>
                <div className="cell">{method}</div>
                <div className="cell">{requestId}</div>
                <div className="cell">{tabId}</div>
                <div className="cell">{type}</div>
                <div className="cell">{url}</div>
                <div className="cell">{sourceRulesTxt}</div>
                <div className="cell">
                    <pre>
                        {formattedJson}
                    </pre>
                </div>
            </div>
        );
    };

    const getTable = () => {
        return (
            <>
                {getActionsBlock()}

                <div className="wrapper">
                    {getTableHeader(titles)}
                    {ruleLog.map((i) => getTableBodyLine(i))}
                </div>
            </>
        );
    };

    return (
        <div className="container">
            { getTable() }
        </div>
    );
};
