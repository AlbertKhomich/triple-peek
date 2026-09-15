export type DescribeTerm = {
    termType: "NamedNode" | "BlankNode" | "Literal" | "DefaultGraph";
    value: string;
    language?: string;
    datatype?: string;
};

export type DescribeQuad = {
    subject: DescribeTerm;
    predicate: DescribeTerm;
    object: DescribeTerm;
    graph?: DescribeTerm;
};

export type DescribeResponse = {
    iri: string;
    contentType: string;
    body: string;
    quads?: DescribeQuad[];
    prefixes?: Record<string, string>;
    parseError?: string | null;
};
