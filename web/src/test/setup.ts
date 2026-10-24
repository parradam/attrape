// jsdom doesn't implement layout, so stub the DOM methods components call.
Element.prototype.scrollIntoView = () => undefined;
