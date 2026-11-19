#!/usr/bin/env python3
"""
scripts/submit_indexnow.py
Wrapper que delega ao script canônico da raiz (`../submit_indexnow.py`) para garantir chave única,
submissão delta-only (<=250 URLs/dia), deduplicação 1x/dia e verificação pós-deploy do Netlify.
"""

import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from submit_indexnow import main  # noqa: E402

if __name__ == "__main__":
    main()
