"""Transform a UBL XML with an XSLT 1.0 stylesheet through libxslt (lxml) and print the HTML to stdout as UTF-8.

Usage: python scripts/xslt-transform.py <stylesheet.xslt> <input.xml>
Reference engine for golden tests (contracts/xslt-codegen.md, "Engines used for parity")."""
import sys

from lxml import etree


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        sys.stderr.write(__doc__ + "\n")
        return 2
    xslt = etree.XSLT(etree.parse(argv[1]))
    result = xslt(etree.parse(argv[2]))
    for entry in xslt.error_log:
        sys.stderr.write(f"{entry.level_name}: {entry.message}\n")
    sys.stdout.buffer.write(str(result).encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
