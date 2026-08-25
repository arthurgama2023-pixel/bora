import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ProdutosRecord extends FirestoreRecord {
  ProdutosRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "name" field.
  String? _name;
  String get name => _name ?? '';
  bool hasName() => _name != null;

  // "description" field.
  String? _description;
  String get description => _description ?? '';
  bool hasDescription() => _description != null;

  // "specifications" field.
  String? _specifications;
  String get specifications => _specifications ?? '';
  bool hasSpecifications() => _specifications != null;

  // "price" field.
  double? _price;
  double get price => _price ?? 0.0;
  bool hasPrice() => _price != null;

  // "created_at" field.
  DateTime? _createdAt;
  DateTime? get createdAt => _createdAt;
  bool hasCreatedAt() => _createdAt != null;

  // "modified_at" field.
  DateTime? _modifiedAt;
  DateTime? get modifiedAt => _modifiedAt;
  bool hasModifiedAt() => _modifiedAt != null;

  // "on_sale" field.
  bool? _onSale;
  bool get onSale => _onSale ?? false;
  bool hasOnSale() => _onSale != null;

  // "sale_price" field.
  double? _salePrice;
  double get salePrice => _salePrice ?? 0.0;
  bool hasSalePrice() => _salePrice != null;

  // "quantity" field.
  int? _quantity;
  int get quantity => _quantity ?? 0;
  bool hasQuantity() => _quantity != null;

  // "parceiro" field.
  DocumentReference? _parceiro;
  DocumentReference? get parceiro => _parceiro;
  bool hasParceiro() => _parceiro != null;

  // "cadastro_user" field.
  DocumentReference? _cadastroUser;
  DocumentReference? get cadastroUser => _cadastroUser;
  bool hasCadastroUser() => _cadastroUser != null;

  // "imagens" field.
  List<String>? _imagens;
  List<String> get imagens => _imagens ?? const [];
  bool hasImagens() => _imagens != null;

  // "avaliacao" field.
  double? _avaliacao;
  double get avaliacao => _avaliacao ?? 0.0;
  bool hasAvaliacao() => _avaliacao != null;

  // "id_produto" field.
  String? _idProduto;
  String get idProduto => _idProduto ?? '';
  bool hasIdProduto() => _idProduto != null;

  // "largura" field.
  int? _largura;
  int get largura => _largura ?? 0;
  bool hasLargura() => _largura != null;

  // "altura" field.
  int? _altura;
  int get altura => _altura ?? 0;
  bool hasAltura() => _altura != null;

  // "comprimento" field.
  int? _comprimento;
  int get comprimento => _comprimento ?? 0;
  bool hasComprimento() => _comprimento != null;

  // "peso" field.
  double? _peso;
  double get peso => _peso ?? 0.0;
  bool hasPeso() => _peso != null;

  // "cep" field.
  String? _cep;
  String get cep => _cep ?? '';
  bool hasCep() => _cep != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "pontos_plus" field.
  int? _pontosPlus;
  int get pontosPlus => _pontosPlus ?? 0;
  bool hasPontosPlus() => _pontosPlus != null;

  // "pontos_platina" field.
  int? _pontosPlatina;
  int get pontosPlatina => _pontosPlatina ?? 0;
  bool hasPontosPlatina() => _pontosPlatina != null;

  // "desconto_plus" field.
  double? _descontoPlus;
  double get descontoPlus => _descontoPlus ?? 0.0;
  bool hasDescontoPlus() => _descontoPlus != null;

  // "desconto_plaft" field.
  double? _descontoPlaft;
  double get descontoPlaft => _descontoPlaft ?? 0.0;
  bool hasDescontoPlaft() => _descontoPlaft != null;

  void _initializeFields() {
    _name = snapshotData['name'] as String?;
    _description = snapshotData['description'] as String?;
    _specifications = snapshotData['specifications'] as String?;
    _price = castToType<double>(snapshotData['price']);
    _createdAt = snapshotData['created_at'] as DateTime?;
    _modifiedAt = snapshotData['modified_at'] as DateTime?;
    _onSale = snapshotData['on_sale'] as bool?;
    _salePrice = castToType<double>(snapshotData['sale_price']);
    _quantity = castToType<int>(snapshotData['quantity']);
    _parceiro = snapshotData['parceiro'] as DocumentReference?;
    _cadastroUser = snapshotData['cadastro_user'] as DocumentReference?;
    _imagens = getDataList(snapshotData['imagens']);
    _avaliacao = castToType<double>(snapshotData['avaliacao']);
    _idProduto = snapshotData['id_produto'] as String?;
    _largura = castToType<int>(snapshotData['largura']);
    _altura = castToType<int>(snapshotData['altura']);
    _comprimento = castToType<int>(snapshotData['comprimento']);
    _peso = castToType<double>(snapshotData['peso']);
    _cep = snapshotData['cep'] as String?;
    _pontos = castToType<int>(snapshotData['pontos']);
    _pontosPlus = castToType<int>(snapshotData['pontos_plus']);
    _pontosPlatina = castToType<int>(snapshotData['pontos_platina']);
    _descontoPlus = castToType<double>(snapshotData['desconto_plus']);
    _descontoPlaft = castToType<double>(snapshotData['desconto_plaft']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('produtos');

  static Stream<ProdutosRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ProdutosRecord.fromSnapshot(s));

  static Future<ProdutosRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ProdutosRecord.fromSnapshot(s));

  static ProdutosRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ProdutosRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ProdutosRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ProdutosRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ProdutosRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ProdutosRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createProdutosRecordData({
  String? name,
  String? description,
  String? specifications,
  double? price,
  DateTime? createdAt,
  DateTime? modifiedAt,
  bool? onSale,
  double? salePrice,
  int? quantity,
  DocumentReference? parceiro,
  DocumentReference? cadastroUser,
  double? avaliacao,
  String? idProduto,
  int? largura,
  int? altura,
  int? comprimento,
  double? peso,
  String? cep,
  int? pontos,
  int? pontosPlus,
  int? pontosPlatina,
  double? descontoPlus,
  double? descontoPlaft,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'name': name,
      'description': description,
      'specifications': specifications,
      'price': price,
      'created_at': createdAt,
      'modified_at': modifiedAt,
      'on_sale': onSale,
      'sale_price': salePrice,
      'quantity': quantity,
      'parceiro': parceiro,
      'cadastro_user': cadastroUser,
      'avaliacao': avaliacao,
      'id_produto': idProduto,
      'largura': largura,
      'altura': altura,
      'comprimento': comprimento,
      'peso': peso,
      'cep': cep,
      'pontos': pontos,
      'pontos_plus': pontosPlus,
      'pontos_platina': pontosPlatina,
      'desconto_plus': descontoPlus,
      'desconto_plaft': descontoPlaft,
    }.withoutNulls,
  );

  return firestoreData;
}

class ProdutosRecordDocumentEquality implements Equality<ProdutosRecord> {
  const ProdutosRecordDocumentEquality();

  @override
  bool equals(ProdutosRecord? e1, ProdutosRecord? e2) {
    const listEquality = ListEquality();
    return e1?.name == e2?.name &&
        e1?.description == e2?.description &&
        e1?.specifications == e2?.specifications &&
        e1?.price == e2?.price &&
        e1?.createdAt == e2?.createdAt &&
        e1?.modifiedAt == e2?.modifiedAt &&
        e1?.onSale == e2?.onSale &&
        e1?.salePrice == e2?.salePrice &&
        e1?.quantity == e2?.quantity &&
        e1?.parceiro == e2?.parceiro &&
        e1?.cadastroUser == e2?.cadastroUser &&
        listEquality.equals(e1?.imagens, e2?.imagens) &&
        e1?.avaliacao == e2?.avaliacao &&
        e1?.idProduto == e2?.idProduto &&
        e1?.largura == e2?.largura &&
        e1?.altura == e2?.altura &&
        e1?.comprimento == e2?.comprimento &&
        e1?.peso == e2?.peso &&
        e1?.cep == e2?.cep &&
        e1?.pontos == e2?.pontos &&
        e1?.pontosPlus == e2?.pontosPlus &&
        e1?.pontosPlatina == e2?.pontosPlatina &&
        e1?.descontoPlus == e2?.descontoPlus &&
        e1?.descontoPlaft == e2?.descontoPlaft;
  }

  @override
  int hash(ProdutosRecord? e) => const ListEquality().hash([
        e?.name,
        e?.description,
        e?.specifications,
        e?.price,
        e?.createdAt,
        e?.modifiedAt,
        e?.onSale,
        e?.salePrice,
        e?.quantity,
        e?.parceiro,
        e?.cadastroUser,
        e?.imagens,
        e?.avaliacao,
        e?.idProduto,
        e?.largura,
        e?.altura,
        e?.comprimento,
        e?.peso,
        e?.cep,
        e?.pontos,
        e?.pontosPlus,
        e?.pontosPlatina,
        e?.descontoPlus,
        e?.descontoPlaft
      ]);

  @override
  bool isValidKey(Object? o) => o is ProdutosRecord;
}
