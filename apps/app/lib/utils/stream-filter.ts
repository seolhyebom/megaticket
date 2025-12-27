

export class ThinkingTagFilter {
    private buffer: string = '';
    private insideThinking: boolean = false;
    private insideJson: boolean = false; // Track JSON block

    process(chunk: string): string {
        this.buffer += chunk;
        let output = '';

        // Repeat processing until stable
        while (true) {
            let actionTaken = false;

            if (this.insideThinking) {
                // Inside <thinking>: look for </thinking>
                // Case insensitive check for closing tag
                const lowerBuffer = this.buffer.toLowerCase();
                const endIndex = lowerBuffer.indexOf('</thinking>');

                if (endIndex !== -1) {
                    // Found closing tag, remove everything up to it
                    this.buffer = this.buffer.slice(endIndex + 11); // 11 = length of </thinking>
                    this.insideThinking = false;
                    actionTaken = true;
                } else {
                    // No closing tag yet.
                    // IMPORTANT: Keep buffer, do NOT output anything.
                    // Break loop to wait for more chunks.
                    break;
                }

            } else if (this.insideJson) {
                // Inside JSON block: look for ```
                const endIndex = this.buffer.indexOf('```');
                if (endIndex !== -1) {
                    this.buffer = this.buffer.slice(endIndex + 3);
                    this.insideJson = false;
                    actionTaken = true;
                } else {
                    break;
                }

            } else {
                // Normal state: look for tags or block starts (Case Insensitive for thinking)
                const lowerBuffer = this.buffer.toLowerCase();
                const thinkingStart = lowerBuffer.indexOf('<thinking>');
                const jsonStart = this.buffer.indexOf('```json'); // JSON marker usually lowercase

                // Find nearest start
                let nearestType: 'thinking' | 'json' | null = null;
                let nearestIndex = -1;

                // Determine which tag comes first
                if (thinkingStart !== -1 && (jsonStart === -1 || thinkingStart < jsonStart)) {
                    nearestType = 'thinking';
                    nearestIndex = thinkingStart;
                } else if (jsonStart !== -1) {
                    nearestType = 'json';
                    nearestIndex = jsonStart;
                }

                if (nearestType === 'thinking') {
                    // Output everything BEFORE the tag
                    output += this.buffer.slice(0, nearestIndex);
                    // Remove the opening tag from buffer
                    this.buffer = this.buffer.slice(nearestIndex + 10); // 10 = length of <thinking>
                    this.insideThinking = true;
                    actionTaken = true;
                } else if (nearestType === 'json') {
                    output += this.buffer.slice(0, nearestIndex);
                    this.buffer = this.buffer.slice(nearestIndex + 7); // ```json length
                    this.insideJson = true;
                    actionTaken = true;
                } else {
                    // No full tags found. Check if we need to wait for a PARTIAL tag.
                    // This prevents outputting "<think" when the next chunk has "ing>".
                    const partialThinking = this.hasPartialMatch('<thinking>');
                    const partialJson = this.hasPartialMatch('```json');

                    if (partialThinking.match || partialJson.match) {
                        // We found a partial match at the end of the buffer.
                        // We must WAIT for the rest of the tag.
                        // Output everything UP TO the start of the partial match.

                        const safeEnd = Math.min(
                            partialThinking.index !== -1 ? partialThinking.index : Infinity,
                            partialJson.index !== -1 ? partialJson.index : Infinity
                        );

                        if (safeEnd < Infinity && safeEnd >= 0) {
                            output += this.buffer.slice(0, safeEnd);
                            this.buffer = this.buffer.slice(safeEnd);
                        }

                        // Break to wait for more data
                        break;
                    } else {
                        // Safe to output everything in buffer
                        output += this.buffer;
                        this.buffer = '';
                        break;
                    }
                }
            }

            if (!actionTaken && (this.insideThinking || this.insideJson)) {
                break; // Wait for closing tag
            }
        }

        return this.cleanOutput(output);
    }

    // Helper to check for partial tag at end of buffer (Case Insensitive)
    private hasPartialMatch(tag: string): { match: boolean, index: number } {
        const run = Math.min(this.buffer.length, tag.length - 1); // Check up to length-1 (full match handled above)
        if (run <= 0) return { match: false, index: -1 };

        const lowerBuffer = this.buffer.toLowerCase();
        const lowerTag = tag.toLowerCase();

        // Check suffix of buffer against prefix of tag
        for (let i = run; i > 0; i--) {
            const suffix = lowerBuffer.slice(-i);
            const prefix = lowerTag.slice(0, i);
            if (suffix === prefix) {
                return { match: true, index: this.buffer.length - i };
            }
        }
        return { match: false, index: -1 };
    }

    flush(): string {
        // If we are still inside a tag at the end of stream, 
        // we generally assume the tag was malformed or incomplete.
        // For <thinking>, it's safer to discard the buffer content to avoid leaking thought fragments.
        // For Normal text, output it.

        let remaining = '';
        if (!this.insideThinking) {
            // If we were waiting for a partial tag that never completed, output it now.
            remaining = this.buffer;
        }

        this.buffer = '';
        this.insideThinking = false;
        this.insideJson = false;

        return this.cleanOutput(remaining);
    }

    private cleanOutput(text: string): string {
        if (!text) return text;
        return text
            .replace(/<\/?tool>/g, '') // Remove tool tags if any leaked
            .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '') // Safety net for full blocks check again
            .replace(/<\/?thinking>/gi, '') // Cleanup orphan tags
            .replace(/\{\s*"(?:performanceId|scheduleId|preferredGrade|groupSize)"[\s\S]*?\}/g, '')
            .replace(/\{[\s\S]*?"performanceId"[\s\S]*?\}/g, '');
    }
}

