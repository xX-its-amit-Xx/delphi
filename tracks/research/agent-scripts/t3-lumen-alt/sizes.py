# total size of Zenodo 15005334, from the file sizes listed by records.py
s = [4294967296] * 3 + [3388490035, 1533643961, 3419901056]
print(sum(s), 'bytes =', sum(s) / 1e9, 'GB')
