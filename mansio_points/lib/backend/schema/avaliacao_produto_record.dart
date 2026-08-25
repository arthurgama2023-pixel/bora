import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AvaliacaoProdutoRecord extends FirestoreRecord {
  AvaliacaoProdutoRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "dono" field.
  DocumentReference? _dono;
  DocumentReference? get dono => _dono;
  bool hasDono() => _dono != null;

  // "nota" field.
  double? _nota;
  double get nota => _nota ?? 0.0;
  bool hasNota() => _nota != null;

  // "comentario" field.
  String? _comentario;
  String get comentario => _comentario ?? '';
  bool hasComentario() => _comentario != null;

  // "data" field.
  DateTime? _data;
  DateTime? get data => _data;
  bool hasData() => _data != null;

  // "produto" field.
  DocumentReference? _produto;
  DocumentReference? get produto => _produto;
  bool hasProduto() => _produto != null;

  // "foto_cliente" field.
  String? _fotoCliente;
  String get fotoCliente => _fotoCliente ?? '';
  bool hasFotoCliente() => _fotoCliente != null;

  // "nome_cliente" field.
  String? _nomeCliente;
  String get nomeCliente => _nomeCliente ?? '';
  bool hasNomeCliente() => _nomeCliente != null;

  void _initializeFields() {
    _dono = snapshotData['dono'] as DocumentReference?;
    _nota = castToType<double>(snapshotData['nota']);
    _comentario = snapshotData['comentario'] as String?;
    _data = snapshotData['data'] as DateTime?;
    _produto = snapshotData['produto'] as DocumentReference?;
    _fotoCliente = snapshotData['foto_cliente'] as String?;
    _nomeCliente = snapshotData['nome_cliente'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('avaliacao_produto');

  static Stream<AvaliacaoProdutoRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AvaliacaoProdutoRecord.fromSnapshot(s));

  static Future<AvaliacaoProdutoRecord> getDocumentOnce(
          DocumentReference ref) =>
      ref.get().then((s) => AvaliacaoProdutoRecord.fromSnapshot(s));

  static AvaliacaoProdutoRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AvaliacaoProdutoRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AvaliacaoProdutoRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AvaliacaoProdutoRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AvaliacaoProdutoRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AvaliacaoProdutoRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAvaliacaoProdutoRecordData({
  DocumentReference? dono,
  double? nota,
  String? comentario,
  DateTime? data,
  DocumentReference? produto,
  String? fotoCliente,
  String? nomeCliente,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'dono': dono,
      'nota': nota,
      'comentario': comentario,
      'data': data,
      'produto': produto,
      'foto_cliente': fotoCliente,
      'nome_cliente': nomeCliente,
    }.withoutNulls,
  );

  return firestoreData;
}

class AvaliacaoProdutoRecordDocumentEquality
    implements Equality<AvaliacaoProdutoRecord> {
  const AvaliacaoProdutoRecordDocumentEquality();

  @override
  bool equals(AvaliacaoProdutoRecord? e1, AvaliacaoProdutoRecord? e2) {
    return e1?.dono == e2?.dono &&
        e1?.nota == e2?.nota &&
        e1?.comentario == e2?.comentario &&
        e1?.data == e2?.data &&
        e1?.produto == e2?.produto &&
        e1?.fotoCliente == e2?.fotoCliente &&
        e1?.nomeCliente == e2?.nomeCliente;
  }

  @override
  int hash(AvaliacaoProdutoRecord? e) => const ListEquality().hash([
        e?.dono,
        e?.nota,
        e?.comentario,
        e?.data,
        e?.produto,
        e?.fotoCliente,
        e?.nomeCliente
      ]);

  @override
  bool isValidKey(Object? o) => o is AvaliacaoProdutoRecord;
}
